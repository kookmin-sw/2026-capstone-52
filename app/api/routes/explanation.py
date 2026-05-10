# 맞춤 설명 라우터 — LLM 기반 설명 생성

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.services import graph_service
from app.schemas.explanation import ExplanationRequest
from app.ai.explanation_ai import generate_explanation
from app.models.user import UserProfile

router = APIRouter()


@router.post("")
def create_explanation(body: ExplanationRequest, db: Session = Depends(get_db)):
    """사용자 질문 + 개념 정보를 기반으로 맞춤 설명 생성 후 반환"""
    node_name, description = "", ""
    if body.node_id:
        node = graph_service.get_node_by_id(body.node_id, db)
        if node:
            node_name = node.name
            description = node.description or ""

    profile = db.query(UserProfile).filter(UserProfile.user_id == body.user_id).first()
    explanation_style = profile.preferred_explanation_style if profile else None

    response_text = generate_explanation(node_name, description, body.question, explanation_style)
    return {"success": True, "data": {"response": response_text}, "message": ""}
