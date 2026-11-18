"""VitaBridge AI Agents — Orchestration (LangChain + OpenAI + Open-Source fallback)"""
import os
from app.services.ml_model import stratify_risk, next_best_action
from app.services.safety import classify_change, check_red_flags, safety_disclaimer

SYSTEM_PROMPT = """You are Nura, VitaBridge AI Prevention Agent. Warm, clear, non-stigmatizing, culturally appropriate.
You NEVER diagnose disease. You interpret risk, explain in plain language, recommend next best action, and escalate to clinician when needed.
Always show: What this means / What could affect it / What you can improve / What happens next.
Language, education, hearing, vision, sleep, mood affect scores — always adjust for them.
"""

class BaseAgent:
    def __init__(self, name): self.name=name
    def _llm_reply(self, user_msg, context):
        # Try OpenAI, fallback to rule-based open-source style reply (no API key needed for MVP)
        key=os.getenv("OPENAI_API_KEY","")
        if key and not key.startswith("sk-your"):
            try:
                from openai import OpenAI
                client=OpenAI(api_key=key)
                r=client.chat.completions.create(model="gpt-4o-mini", messages=[{"role":"system","content":SYSTEM_PROMPT},{"role":"user","content":f"Context: {context}\nUser: {user_msg}"}], max_tokens=350)
                return r.choices[0].message.content
            except Exception as e: pass
        # Open-source / offline fallback — BioBERT-style knowledge + rules
        return self._fallback(user_msg, context)
    def _fallback(self, msg, ctx):
        m=msg.lower()
        if "scared" in m or "alzheimer" in m: return "It's completely normal to feel worried. Screening catches change early — it doesn't give a diagnosis. Your pattern looks more linked to sleep and hearing than anything else. Let's check those first, then re-check. Would you like me to explain the next step or connect you to your clinician?"
        if "missed" in m or "transport" in m: return "Was it transport, time, worry, or you didn't see the value? I can find a closer clinic, reschedule to Thursday, or book you with a family member. Which helps most?"
        if "baby" in m or "behind" in m: return "Every child develops at their own pace. Let's look at his pattern over time, not one moment. Try 2 play activities daily — talk & sing during feeding and 10 mins tummy time — and we'll re-check next month. You're doing great by noticing early."
        return f"Thanks for sharing. Based on your baseline and recent {ctx.get('kind','screening')}, your status is {ctx.get('status','STABLE')}. Your next best action is: {ctx.get('next_action','Continue your weekly plan')}. {safety_disclaimer()}"

class ChildDevelopmentAgent(BaseAgent):
    def __init__(self): super().__init__("ChildDevelopmentAgent")
    def assess(self, age_months, milestones: dict, growth: dict):
        # Milestone logic: delayed if 2+ milestones missed for age band
        delayed=[k for k,v in milestones.items() if not v]
        status="STABLE" if len(delayed)<=1 else ("WATCH" if len(delayed)==2 else "ACT")
        risk, factors, conf = stratify_risk({"moca_or_milestone_score": 25-len(delayed)*3, "missed_visits": growth.get("missed_visits",0)})
        return {"agent":self.name,"status":status,"risk":risk,"delayed_milestones":delayed,"modifiable":factors,"next_action":next_best_action(risk,[],[]),"message":self._fallback("baby development check", {"status":status,"next_action":"Play-based activities + re-check in 1 month"})}

class AdultBrainHealthAgent(BaseAgent):
    def __init__(self): super().__init__("AdultBrainHealthAgent")
    def assess(self, baseline_moca, current_moca, context: dict):
        status=classify_change(baseline_moca, current_moca, context)
        risk, factors, conf = stratify_risk({"moca_or_milestone_score":current_moca,"sleep_hours":context.get("sleep_hours",7),"hearing_loss":context.get("hearing_loss",False),"bp_high":context.get("bp_high",False),"mood_score":context.get("mood_score",5),"missed_visits":context.get("missed_visits",0)})
        return {"agent":self.name,"status":status,"risk":risk,"modifiable":factors,"confidence":conf,"next_action":next_best_action(risk, context.get("open_loops",[]), []),"red_flags":check_red_flags(context.get("notes","")),"disclaimer":safety_disclaimer()}

class TriageAgent(BaseAgent):
    def __init__(self): super().__init__("TriageAgent")
    def route(self, status, risk):
        if status=="REFER" or risk=="ELEVATED": return {"specialty":"Neurology / Geriatrics","urgency":"Within 7 days","action":"Escalate to clinician"}
        if status=="ACT": return {"specialty":"Family Medicine + Audiology","urgency":"Within 30 days","action":"Book follow-up"}
        return {"specialty":"Primary Care","urgency":"Routine","action":"Continue prevention plan"}

CHILD_AGENT=ChildDevelopmentAgent(); ADULT_AGENT=AdultBrainHealthAgent(); TRIAGE=TriageAgent()
