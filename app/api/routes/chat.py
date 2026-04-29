# 채팅 라우터 — AI 응답 반환 및 그래프 자동 업데이트

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.services import graph_service
from app.schemas.chat import ChatRequest
from app.models.graph import ConceptNode
from app.ai.chat_ai import process_chat

router = APIRouter()


@router.post("/{project_id}")
def chat(project_id: str, body: ChatRequest, db: Session = Depends(get_db)):
    """채팅 메시지 처리 — AI 응답 반환 및 이해한 개념 노드 상태를 KNOWN으로 갱신"""
    nodes = db.query(ConceptNode).filter(ConceptNode.project_id == project_id).all()
    node_list = [{"node_id": n.node_id, "name": n.name, "status": n.status} for n in nodes]

    result = process_chat(body.message, node_list)

    for node_id in result.get("understood_nodes", []):
        graph_service.update_node_status(node_id, "KNOWN", 1.0, db)

    return {
        "success": True,
        "data": {"reply": result["reply"], "updated_nodes": result.get("understood_nodes", [])},
        "message": "",
    }
