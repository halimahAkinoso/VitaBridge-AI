"""Clinical Safety Guardrails — AI NEVER diagnoses."""
RED_FLAGS=["suicidal","self-harm","cannot do daily tasks","lost milestone","regression","rapid weight loss","severe mood drop"]
def check_red_flags(text: str):
    t=text.lower()
    return [f for f in RED_FLAGS if f in t]
def safety_disclaimer():
    return "Screening identifies risk — not disease. This is not a diagnosis. A clinician must review REFER cases."
def classify_change(baseline: float, current: float, context: dict):
    """Meaningful Change Detection: trend + context, not single score."""
    if baseline==0: return "STABLE"
    delta=(current-baseline)/baseline
    # Adjust for confounders: poor sleep/hearing inflates apparent decline
    confounder_penalty=0
    if context.get("poor_sleep"): confounder_penalty+=0.03
    if context.get("hearing_loss"): confounder_penalty+=0.03
    if context.get("low_mood"): confounder_penalty+=0.02
    adj_delta=delta+confounder_penalty
    if adj_delta < -0.20: return "REFER"
    if adj_delta < -0.12: return "ACT"
    if adj_delta < -0.07: return "WATCH"
    return "STABLE"
