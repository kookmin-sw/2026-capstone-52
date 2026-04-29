from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class NodeResponse(BaseModel):
    node_id: str
    project_id: str
    file_id: Optional[str]
    name: str
    description: Optional[str]
    group: Optional[str]
    status: str
    score: float
    updated_at: datetime

    class Config:
        from_attributes = True


class EdgeResponse(BaseModel):
    edge_id: str
    project_id: str
    source_node_id: str
    target_node_id: str
    relation_type: str
    weight: float

    class Config:
        from_attributes = True


class GraphResponse(BaseModel):
    nodes: list[NodeResponse]
    edges: list[EdgeResponse]
