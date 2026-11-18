from app.services.agent import ADULT_AGENT, CHILD_AGENT, TRIAGE
from app.services.ml_model import stratify_risk
from app.services.safety import classify_change


def test_adult_scores_are_not_interpreted_without_approved_instrument_context():
    result = ADULT_AGENT.assess(
        26,
        24,
        {"poor_sleep": True, "hearing_loss": True},
    )
    assert result["status"] == "NOT_ASSESSED"
    assert result["risk"] == "NOT_ASSESSED"
    assert result["comparison_available"] is False
    assert "confidence" not in result


def test_child_observations_do_not_create_a_score_or_risk_label():
    result = CHILD_AGENT.assess(
        4,
        {"smile": True, "babble": False, "roll": True},
        {},
    )
    assert result["status"] == "NOT_ASSESSED"
    assert result["risk"] == "NOT_ASSESSED"
    assert result["observations_recorded"] == ["smile", "babble", "roll"]


def test_unvalidated_risk_and_change_helpers_refuse_to_classify():
    assert stratify_risk({"sleep_hours": 3}) == ("NOT_ASSESSED", [], None)
    assert classify_change(26, 24, {"poor_sleep": True}) == "NOT_ASSESSED"
    assert TRIAGE.route("REFER", "ELEVATED")["automated_referral_created"] is False
