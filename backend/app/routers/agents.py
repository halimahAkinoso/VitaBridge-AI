from fastapi import APIRouter
from app.services.agent import CHILD_AGENT, ADULT_AGENT
from app.services.clinical_question_planner import build_monitoring_plan
router=APIRouter()
@router.post("/chat")
def chat(payload: dict):
    msg=payload.get("message",""); ctx=payload.get("context",{})
    agent=CHILD_AGENT if ctx.get("type")=="child" else ADULT_AGENT
    reply=agent._llm_reply(msg, ctx)
    return {"reply":reply,"agent":agent.name,"suggested_actions":["Explain my result","Book follow-up","I missed my visit"]}
@router.post("/nudge")
def nudge(payload: dict):
    barrier=payload.get("barrier","transport")
    solutions={"transport":"Nearest clinic 8 mins away — Thu 10am. Want me to book it?","time":"Evening slot available — 6pm. Or 10-min home check first?","worry":"Here's a 2-min video from Dr. Sara explaining what happens. No diagnosis, just a check-up.","value":"Early checks catch change when it's most reversible. Your baseline is your superpower.","cost":"Free IFHAS screening available at your clinic this week."}
    return {"barrier":barrier,"solution":solutions.get(barrier, solutions["transport"]),"action":"One-tap booking"}
@router.post("/proactive-check")
def proactive(payload: dict):
    # ACTIVE agent: runs daily, not waiting for user
    return {"checks":["Sleep check-in due","Hearing follow-up still OPEN — 12 days","Child Visit #4 in 5 days"],"next_best_action":"Close hearing follow-up loop today","alerts":1}

@router.post("/monitoring-plan")
def monitoring_plan(payload: dict):
    """Return approved follow-up questions and actions for a check-in."""
    return build_monitoring_plan(payload)
