from sqlalchemy.orm import Session
from app.models.learning_log import LearningLog
from app.schemas.learning_log import LearningLogCreate


def create_learning_log(db: Session, log_data: LearningLogCreate):
    log = LearningLog(
        user_id=log_data.user_id,
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
