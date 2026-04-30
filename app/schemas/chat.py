from pydantic import BaseModel
from typing import Optional


class ChatRequest(BaseModel):
    user_id: int
    message: str
    response_type: Optional[str] = "default"


class ChatResponse(BaseModel):
    reply: str
    updated_nodes: list = []
