from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional


class NodeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    node_id: str
    project_id: int
    file_id: Optional[str]
    concept_id: Optional[str] = None
    subject_id: Optional[str] = None
    name: str
    description: Optional[str]
    group: Optional[str]
    status: str
    understanding_score: Optional[float]
    understanding_level: Optional[int] = None
    confidence: Optional[float] = None
    diagnosis_count: Optional[int] = None
    core_score: Optional[float] = None
    is_core: Optional[bool] = None
    node_source: Optional[str] = None
    updated_at: datetime


class EdgeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    edge_id: str
    project_id: int
    source_node_id: str
    target_node_id: str
    relation_type: str
    weight: float


class RelatedChatResponse(BaseModel):
    chat_id: int
    date: str        # "YYYY.MM.DD" 형식
    message: str     # user_message


class NodeDetailResponse(NodeResponse):
    related_nodes: list[str]              # 연결된 노드 이름 목록
    related_chats: list[RelatedChatResponse]


class GraphResponse(BaseModel):
    nodes: list[NodeResponse]
    edges: list[EdgeResponse]
