from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.sql import func

from app.db.base import Base


class ConceptQuizCounter(Base):
    __tablename__ = "concept_quiz_counters"
    __table_args__ = (
        UniqueConstraint("project_id", "node_id", name="uq_concept_quiz_counters_project_node"),
    )

    counter_id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.project_id"), nullable=False, index=True)
    node_id = Column(String, ForeignKey("concept_nodes.node_id"), nullable=False, index=True)
    mention_count = Column(Integer, nullable=False, default=0)
    last_counted_chat_id = Column(Integer, ForeignKey("chats.chat_id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
