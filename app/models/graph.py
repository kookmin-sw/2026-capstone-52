import uuid
from datetime import datetime
from sqlalchemy import String, Float, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base


class ConceptNode(Base):
    __tablename__ = "concept_nodes"

    node_id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id: Mapped[str] = mapped_column(String, ForeignKey("projects.project_id"), nullable=False)
    file_id: Mapped[str] = mapped_column(String, ForeignKey("files.file_id"), nullable=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(String, nullable=True)
    group: Mapped[str] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, default="UNKNOWN")
    # UNKNOWN / PARTIAL / KNOWN / NEEDS_REVIEW
    score: Mapped[float] = mapped_column(Float, default=0.0)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ConceptEdge(Base):
    __tablename__ = "concept_edges"

    edge_id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id: Mapped[str] = mapped_column(String, ForeignKey("projects.project_id"), nullable=False)
    source_node_id: Mapped[str] = mapped_column(String, ForeignKey("concept_nodes.node_id"), nullable=False)
    target_node_id: Mapped[str] = mapped_column(String, ForeignKey("concept_nodes.node_id"), nullable=False)
    relation_type: Mapped[str] = mapped_column(String, nullable=False)
    # prerequisite / part_of
    weight: Mapped[float] = mapped_column(Float, default=1.0)
