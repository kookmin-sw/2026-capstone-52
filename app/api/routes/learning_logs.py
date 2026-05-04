from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.learning_log import LearningLogCreate
from app.services.learning_log_service import create_learning_log, get_learning_logs_by_user
from app.utils.response import success_response

router = APIRouter()


@router.post("/")
def create_learning_log_api(log_data: LearningLogCreate, db: Session = Depends(get_db)):
    log = create_learning_log(db, log_data)

    data = {
        "activity_id": log.activity_id,
        "user_id": log.user_id,
        "project_id": log.project_id,
        "activity_type": log.activity_type,
        "activity_summary": log.activity_summary,
        "created_at": log.created_at,
    }

    return success_response(data, "학습 기록이 저장되었습니다.")


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
