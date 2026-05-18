from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.db.base import Base


class LearningLog(Base):
    __tablename__ = "learning_logs"

    activity_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    project_id = Column(Integer, ForeignKey("projects.project_id"), nullable=True)
    activity_type = Column(String, nullable=False)
    activity_summary = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
