from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.security import get_current_user, get_optional_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.learning_log import LearningLogCreate
from app.services.learning_log_service import create_learning_log, get_learning_logs_by_user
from app.utils.response import success_response

router = APIRouter()


@router.post("/")
def create_learning_log_api(
    log_data: LearningLogCreate,
    current_user: User | None = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user.user_id if current_user else log_data.user_id

    if user_id is None:
        raise HTTPException(status_code=400, detail="user_id 또는 인증 토큰이 필요합니다.")

    log = create_learning_log(db, log_data, user_id=user_id)

    data = {
        "activity_id": log.activity_id,
        "user_id": log.user_id,
        "project_id": log.project_id,
        "activity_type": log.activity_type,
        "activity_summary": log.activity_summary,
        "created_at": log.created_at,
    }

    return success_response(data, "학습 기록이 저장되었습니다.")


@router.get("/me")
def get_my_learning_logs_api(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    logs = get_learning_logs_by_user(db, current_user.user_id)

    data = [
        {
            "activity_id": log.activity_id,
            "user_id": log.user_id,
            "project_id": log.project_id,
            "activity_type": log.activity_type,
            "activity_summary": log.activity_summary,
            "created_at": log.created_at,
        }
        for log in logs
    ]

    return success_response(data, "학습 기록 조회 성공")


@router.get("/user/{user_id}")
def get_learning_logs_api(user_id: int, db: Session = Depends(get_db)):
    logs = get_learning_logs_by_user(db, user_id)

    data = [
        {
            "activity_id": log.activity_id,
            "user_id": log.user_id,
            "project_id": log.project_id,
            "activity_type": log.activity_type,
            "activity_summary": log.activity_summary,
            "created_at": log.created_at,
        }
        for log in logs
    ]

    return success_response(data, "학습 기록 조회 성공")
