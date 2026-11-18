from app.services.agent import ADULT_AGENT, CHILD_AGENT
def test_adult_watch():
    r=ADULT_AGENT.assess(26,24,{"poor_sleep":True,"hearing_loss":True})
    assert r["status"] in ["WATCH","ACT","REFER"]
def test_child():
    r=CHILD_AGENT.assess(4,{"smile":True,"babble":False,"roll":True},{})
    assert "status" in r
