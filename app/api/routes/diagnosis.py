from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.services import diagnosis_service
from app.schemas.diagnosis import DiagnosisAnswerRequest

router = APIRouter()


@router.post("/{project_id}/questions")
def generate_question(project_id: str, db: Session = Depends(get_db)):
    # TODO: 그래프 기반 질문 생성 (AI 호출) 구현
    return {"success": True, "data": None, "message": "미구현"}


@router.post("/{project_id}/answers")
def submit_answer(project_id: str, body: DiagnosisAnswerRequest, db: Session = Depends(get_db)):
    session = diagnosis_service.save_diagnosis_answer(body.diagnosis_id, body.answer, db)
    if not session:
        raise HTTPException(status_code=404, detail="진단 세션을 찾을 수 없습니다.")
    # TODO: 이해도 추정 및 그래프 상태 갱신 로직 추가
    return {"success": True, "data": None, "message": "답변 저장 완료"}


@router.get("/{project_id}/status")
def get_diagnosis_status(project_id: str, db: Session = Depends(get_db)):
    status = diagnosis_service.get_diagnosis_status(project_id, db)
    return {"success": True, "data": status, "message": ""}
