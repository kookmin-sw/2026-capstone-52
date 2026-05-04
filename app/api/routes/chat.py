# 채팅 라우터 — AI 응답 반환, 그래프 자동 업데이트, 대화 기록 저장

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.services import graph_service
from app.schemas.chat import ChatRequest
from app.models.graph import ConceptNode
from app.ai.chat_ai import process_chat
from app.services.chat_service import save_chat, get_chats_by_project
from app.utils.response import success_response

router = APIRouter()


@router.post("/{project_id}")
def chat(project_id: int, body: ChatRequest, db: Session = Depends(get_db)):
    """
    채팅 메시지 처리
    - AI 응답 생성
    - 이해한 개념 노드 상태를 KNOWN으로 갱신
    - 질문/답변 대화 기록 저장
    - learning_logs 자동 기록
    """
    nodes = db.query(ConceptNode).filter(ConceptNode.project_id == project_id).all()
    node_list = [
        {"node_id": n.node_id, "name": n.name, "status": n.status}
        for n in nodes
    ]

    try:
        result = process_chat(body.message, node_list)
        ai_reply = result["reply"]
        updated_nodes = result.get("understood_nodes", [])
    except NotImplementedError:
        ai_reply = "AI 응답 생성 로직 연결 전입니다."
        updated_nodes = []

    for node_id in updated_nodes:
        graph_service.update_node_status(node_id, "KNOWN", db)

    chat_log = save_chat(
        db=db,
        project_id=project_id,
        chat_data=body,
        ai_response=ai_reply,
    )

    data = {
        "chat_id": chat_log.chat_id,
        "user_id": chat_log.user_id,
        "project_id": chat_log.project_id,
        "user_message": chat_log.user_message,
        "ai_response": chat_log.ai_response,
        "response_type": chat_log.response_type,
        "updated_nodes": updated_nodes,
        "created_at": chat_log.created_at,
    }

    return success_response(data, "채팅 응답 및 기록 저장 성공")


@router.get("/project/{project_id}")
def get_project_chats(project_id: int, db: Session = Depends(get_db)):
    chats = get_chats_by_project(db, project_id)

    data = [
        {
            "chat_id": chat.chat_id,
            "user_id": chat.user_id,
            "project_id": chat.project_id,
            "user_message": chat.user_message,
            "ai_response": chat.ai_response,
            "response_type": chat.response_type,
            "created_at": chat.created_at,
        }
        for chat in chats
    ]

    return success_response(data, "프로젝트 대화 기록 조회 성공")
