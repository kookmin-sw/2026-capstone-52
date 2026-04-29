# 지식 그래프 테이블 — AI가 추출한 개념(노드)과 개념 간 관계(엣지)를 저장

import uuid
from datetime import datetime
from sqlalchemy import String, Float, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base


class ConceptNode(Base):
    """개념 노드 — AI가 PDF에서 추출한 핵심 개념 하나"""
    __tablename__ = "concept_nodes"

    node_id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id: Mapped[str] = mapped_column(String, nullable=False)
    file_id: Mapped[str] = mapped_column(String, ForeignKey("files.file_id"), nullable=True)  # 어떤 파일에서 추출했는지
    name: Mapped[str] = mapped_column(String, nullable=False)         # 개념명 (예: "극한")
    description: Mapped[str] = mapped_column(String, nullable=True)   # 개념 설명
    group: Mapped[str] = mapped_column(String, nullable=True)         # 상위 주제 (예: "미적분")
    status: Mapped[str] = mapped_column(String, default="UNKNOWN")  # UNKNOWN / KNOWN
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ConceptEdge(Base):
    """개념 엣지 — 두 개념 사이의 관계"""
    __tablename__ = "concept_edges"

    edge_id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id: Mapped[str] = mapped_column(String, nullable=False)
    source_node_id: Mapped[str] = mapped_column(String, ForeignKey("concept_nodes.node_id"), nullable=False)
    target_node_id: Mapped[str] = mapped_column(String, ForeignKey("concept_nodes.node_id"), nullable=False)
    relation_type: Mapped[str] = mapped_column(String, nullable=False)
    # MVP 관계 타입: prerequisite(선수 개념) / part_of(포함 관계)
    weight: Mapped[float] = mapped_column(Float, default=1.0)         # 관계 강도 0.0 ~ 1.0
