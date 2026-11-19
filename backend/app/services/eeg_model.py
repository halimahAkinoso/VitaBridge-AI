"""EEG technical preprocessing and band-power features; no clinical classification."""
from __future__ import annotations

from pathlib import Path


LABRAM_MODEL = "LaBraM"
EEGNET_MODEL = "EEGNet"


def analyze_eeg(eeg_file: str | Path) -> dict:
    """Read an EDF recording and calculate descriptive EEG spectral features."""
    path = Path(eeg_file)
    if not path.is_file():
        raise FileNotFoundError("The EEG file is not available.")
    if path.suffix.lower() != ".edf":
        raise ValueError("EEG input must be an EDF file with a known acquisition protocol.")

    try:
        import mne
        import numpy as np
        from scipy.signal import welch
    except ImportError as exc:
        raise RuntimeError("Install the EEG extras before processing EDF recordings.") from exc

    raw = mne.io.read_raw_edf(path, preload=True, verbose="ERROR")
    picks = mne.pick_types(raw.info, eeg=True, exclude="bads")
    if len(picks) < 2 or raw.info["sfreq"] < 128 or raw.n_times < raw.info["sfreq"] * 10:
        raise ValueError(
            "The EDF must contain at least two EEG channels, sample at 128 Hz or higher, "
            "and include ten seconds of signal."
        )

    sample_rate = float(raw.info["sfreq"])
    processed = raw.copy()
    processed.filter(
        l_freq=0.5,
        h_freq=40.0,
        picks=picks,
        method="iir",
        iir_params={"order": 4, "ftype": "butter"},
        verbose="ERROR",
    )
    processed.notch_filter(
        freqs=[50.0],
        picks=picks,
        method="iir",
        verbose="ERROR",
    )
    data = processed.get_data(picks=picks)
    nperseg = min(data.shape[1], max(32, int(sample_rate * 4)))
    frequencies, powers = welch(data, fs=sample_rate, nperseg=nperseg, axis=1)
    mean_power = np.mean(powers, axis=0)

    def band_power(low: float, high: float) -> float:
        band = (frequencies >= low) & (frequencies < high)
        if not band.any():
            return 0.0
        return float(np.trapezoid(mean_power[band], frequencies[band]))

    theta = band_power(4.0, 8.0)
    alpha = band_power(8.0, 13.0)
    return {
        "alpha_power": round(alpha, 6),
        "theta_alpha_ratio": round(theta / alpha, 4) if alpha > 0 else None,
        "sleep_quality_index": None,
        "eeg_flag": "NOT_ASSESSED",
        "recording_duration_seconds": round(raw.n_times / sample_rate, 1),
        "eeg_channel_count": int(len(picks)),
        "sampling_rate_hz": sample_rate,
        "preprocessing": "0.5-40 Hz band-pass and 50 Hz notch; descriptive features only",
        "models": {
            "embedding": LABRAM_MODEL,
            "classifier": EEGNET_MODEL,
            "loaded": False,
        },
        "interpretation": (
            "Band power is a descriptive signal feature, not a dementia or sleep diagnosis. "
            "LaBraM/EEGNet scores are unavailable until locally validated weights and "
            "an acquisition protocol are approved."
        ),
    }
