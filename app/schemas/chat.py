from datetime import datetime
from pydantic import BaseModel
from typing import Optional


class ChatRequest(BaseModel):
    user_id: Optional[int] = None
    message: str
    response_type: Optional[str] = "default"


class ChatResponse(BaseModel):
    reply: str
    updated_nodes: list = []


class ChatSessionCreate(BaseModel):
    title: Optional[str] = "새 채팅방"


class ChatSessionResponse(BaseModel):
    id: int
    project_id: int
    title: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
