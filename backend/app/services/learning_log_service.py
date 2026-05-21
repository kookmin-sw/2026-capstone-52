from sqlalchemy.orm import Session
from app.models.learning_log import LearningLog
from app.schemas.learning_log import LearningLogCreate


def create_learning_log(db: Session, log_data: LearningLogCreate, user_id: int | None = None):
    resolved_user_id = user_id if user_id is not None else log_data.user_id

    if resolved_user_id is None:
        raise ValueError("user_id가 필요합니다.")

    log = LearningLog(
        user_id=resolved_user_id,
        project_id=log_data.project_id,
        activity_type=log_data.activity_type,
        activity_summary=log_data.activity_summary,
    )

    db.add(log)
    db.commit()
    db.refresh(log)

    return log


def get_learning_logs_by_user(db: Session, user_id: int, limit: int = 10):
    return (
        db.query(LearningLog)
        .filter(LearningLog.user_id == user_id)
        .order_by(LearningLog.created_at.desc())
        .limit(limit)
        .all()
    )
