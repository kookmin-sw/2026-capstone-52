from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.schemas.explanation import ExplanationRequest, ExplanationResponse

router = APIRouter()


@router.post("")
def create_explanation(body: ExplanationRequest, db: Session = Depends(get_db)):
    # TODO: Bedrock(Claude) 호출 로직 구현
    return {"success": True, "data": None, "message": "미구현"}


@router.get("/{project_id}")
def get_explanation_list(project_id: str, db: Session = Depends(get_db)):
    # TODO: explanation_logs 조회 구현
    return {"success": True, "data": [], "message": "미구현"}


@router.patch("/{explanation_id}")
def end_explanation_session(explanation_id: str, db: Session = Depends(get_db)):
    # TODO: ended_at 기록 구현
    return {"success": True, "data": None, "message": "미구현"}
