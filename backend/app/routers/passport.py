from fastapi import APIRouter
router=APIRouter()
@router.get("/{person_id}")
def passport(person_id: int):
    # CONNECT: unify data — in prod joins screening+clinical+lab+wearable
    return {"person_id":person_id,"passport":"Family Health Passport","due":["IFHAS Screening","Hearing Follow-up"],"completed":["MoCA Baseline","Vision Screen"],"missed":["Hearing Follow-up"],"milestones":{"child":"3 of 14 Well-Child Visits","adult":"IFHAS 78% complete"},"care_gaps":["Hearing follow-up open","Child Visit #4 due in 5 days"]}
@router.get("/family/{owner_id}")
def family(owner_id: int):
    return {"family":[{"id":1,"name":"Amina","age":62,"type":"adult","progress":78,"status":"WATCH"},{"id":2,"name":"Yusuf","age":"4 months","type":"child","progress":21,"status":"STABLE"}]}
