from fastapi import APIRouter
router=APIRouter()
@router.get("/{person_id}")
def notifs(person_id: int):
    return {"notifications":[{"id":1,"title":"Hearing follow-up still open","body":"12 days open — book in 1 tap","barrier":"transport"},{"id":2,"title":"Yusuf Visit #4 in 5 days","body":"Growth + language check — 20 mins"},{"id":3,"title":"Sleep check-in","body":"How did you sleep last night? 30 sec"}]}
