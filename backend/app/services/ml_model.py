"""Compatibility helpers that refuse unvalidated risk scoring."""


def stratify_risk(features: dict):
    """Risk cannot be assigned from the current unvalidated prototype inputs."""
    return ("NOT_ASSESSED", [], None)


def next_best_action(risk, open_loops, barriers):
    if open_loops:
        return "Contact your care team about the open follow-up."
    return "Review your next preventive-care step with your care team."
