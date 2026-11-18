
"""
VitaBridge developmental screening instrument registry.

Protected questionnaire content and official scoring rules must
only be added after the relevant permissions and approvals.
"""

INSTRUMENTS = {
    "vitabridge_surveillance": {
        "code": "vitabridge_surveillance",
        "name": "VitaBridge Developmental Surveillance",
        "version": "1.0",
        "status": "active_prototype",
        "age_min_months": 1,
        "age_max_months": 72,
        "description": (
            "Caregiver observations across four developmental domains. "
            "Not a validated diagnostic instrument."
        ),
        "scoring_enabled": False,
        "clinical_interpretation": False,
    },
    "peds": {
        "code": "peds",
        "name": "PEDS",
        "version": "pending",
        "status": "approval_required",
        "age_min_months": None,
        "age_max_months": None,
        "description": "Integration pending permission and approved materials.",
        "scoring_enabled": False,
        "clinical_interpretation": False,
    },
    "peds_r": {
        "code": "peds_r",
        "name": "PEDS-R",
        "version": "pending",
        "status": "approval_required",
        "age_min_months": None,
        "age_max_months": None,
        "description": "Integration pending permission and approved materials.",
        "scoring_enabled": False,
        "clinical_interpretation": False,
    },
    "abu_dhabi": {
        "code": "abu_dhabi",
        "name": "Abu Dhabi Developmental Screening Instrument",
        "version": "pending",
        "status": "approval_required",
        "age_min_months": None,
        "age_max_months": None,
        "description": "Integration pending confirmation of instrument version, permission and approved materials.",
        "scoring_enabled": False,
        "clinical_interpretation": False,
    },
}


def get_instrument(code: str):
    return INSTRUMENTS.get(code)


def list_instruments():
    return list(INSTRUMENTS.values())


def get_active_instruments():
    return [
        instrument
        for instrument in INSTRUMENTS.values()
        if instrument["status"] == "active_prototype"
    ]
