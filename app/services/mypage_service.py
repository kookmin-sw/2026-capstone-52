from sqlalchemy.orm import Session

from app.models.user import User, UserProfile
from app.models.project import Project
from app.models.learning_log import LearningLog


def get_mypage_data(db: Session, user_id: int):
    user = db.query(User).filter(User.user_id == user_id).first()
    profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()

    project_count = db.query(Project).filter(Project.user_id == user_id).count()

    recent_projects = (
        db.query(Project)
        .filter(Project.user_id == user_id)
        .order_by(Project.created_at.desc())
        .limit(3)
        .all()
    )

    recent_logs = (
        db.query(LearningLog)
        .filter(LearningLog.user_id == user_id)
        .order_by(LearningLog.created_at.desc())
        .limit(5)
        .all()
    )

    return {
        "user": user,
        "profile": profile,
        "project_count": project_count,
        "recent_projects": recent_projects,
        "recent_logs": recent_logs,
    }
