from datetime import datetime, timezone
from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base


class DeferredMiniQuiz(Base):
    __tablename__ = "deferred_mini_quizzes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(Integer, ForeignKey("projects.project_id"), nullable=False, index=True)
    node_id: Mapped[str] = mapped_column(String, ForeignKey("concept_nodes.node_id"), nullable=False)
    question_id: Mapped[str] = mapped_column(String, ForeignKey("diagnosis_questions.question_id"), nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, default="PENDING")  # PENDING / COMPLETED
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    completed_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
