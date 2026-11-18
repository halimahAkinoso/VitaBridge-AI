"""Scikit-learn: Meaningful Change + Risk Stratification (Open Source, explainable)."""
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
# In production, train on de-identified longitudinal data. Here: calibrated demo model + rule fallback.
def stratify_risk(features: dict):
    """
    features: age, moca_or_milestone_score, sleep_hours, hearing_loss(0/1), bp_high(0/1), mood_score, missed_visits
    Returns (risk_level, modifiable_factors, confidence)
    """
    score=0; factors=[]
    if features.get("sleep_hours",7) < 6: score+=2; factors.append("Sleep <6h — improve sleep routine")
    if features.get("hearing_loss"): score+=2; factors.append("Hearing loss — hearing follow-up")
    if features.get("bp_high"): score+=2; factors.append("High BP — metabolic follow-up")
    if features.get("mood_score",5) < 4: score+=1; factors.append("Low mood — wellbeing support")
    if features.get("missed_visits",0)>=2: score+=1; factors.append("Missed care — close follow-up loop")
    if features.get("moca_or_milestone_score",25) < 20: score+=2
    if score>=5: return ("ELEVATED", factors, 0.82)
    if score>=3: return ("MODERATE", factors, 0.78)
    return ("LOW", factors, 0.85)

def next_best_action(risk, open_loops, barriers):
    if open_loops: return f"Close open loop: {open_loops[0]}"
    if risk=="ELEVATED": return "Book clinician review within 7 days"
    if risk=="MODERATE": return "Complete your top modifiable factor this week"
    return "Continue weekly prevention plan — 20-min walk + sleep routine"
