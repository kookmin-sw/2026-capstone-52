# 맞춤 설명 라우터 — 설명 생성 요청을 service에 위임

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.security import get_optional_current_user
from app.db.session import get_db
from app.models.project import Project
from app.models.user import User
from app.schemas.explanation import ExplanationRequest
from app.services.explanation_service import generate_personalized_explanation

router = APIRouter()


@router.post("")
def create_explanation(
    body: ExplanationRequest,
    current_user: User | None = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    """사용자 질문과 그래프/진단 context를 바탕으로 맞춤 설명을 생성한다."""
    user_id = current_user.user_id if current_user else body.user_id

    if user_id is None:
        raise HTTPException(status_code=400, detail="user_id 또는 인증 토큰이 필요합니다.")

    if current_user:
        project = db.query(Project).filter(Project.project_id == body.project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다.")
        if project.user_id != current_user.user_id:
            raise HTTPException(status_code=403, detail="프로젝트 접근 권한이 없습니다.")

    try:
        result = generate_personalized_explanation(
            project_id=body.project_id,
            user_id=user_id,
            node_id=body.node_id,
            question=body.question,
            db=db,
            explanation_style=body.explanation_style,
        )
    except ValueError as error:
        message = str(error)
        status_code = 404 if "찾을 수 없습니다" in message or "설명 가능한 개념이 없습니다" in message else 400
        raise HTTPException(status_code=status_code, detail=message) from error
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"맞춤 설명 생성 중 오류가 발생했습니다: {error}") from error

    return {"success": True, "data": result, "message": ""}
