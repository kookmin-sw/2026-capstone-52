# 채팅 라우터 — AI 응답 반환, 그래프 자동 업데이트, 대화 기록 저장

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.services import graph_service
from app.schemas.chat import ChatRequest
from app.models.graph import ConceptNode
from app.models.user import UserProfile
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
    # process_chat에 넘길 allowed_concepts 구성 — node_id 기반으로 signal 반영 시 빠른 조회용 map도 함께 생성
    nodes = db.query(ConceptNode).filter(ConceptNode.project_id == project_id).all()
    node_map = {n.node_id: n for n in nodes}
    allowed_concepts = [
        {"node_id": n.node_id, "concept_id": n.concept_id, "concept_name": n.name,
         "understanding_score": n.understanding_score}
        for n in nodes
    ]

    # explanation_style → user_state dict로 감싸서 keyword-only 인자로 전달
    profile = db.query(UserProfile).filter(UserProfile.user_id == body.user_id).first()
    user_state = {"preferred_explanation_style": profile.preferred_explanation_style} if profile else None

    try:
        result = process_chat(
            body.message,
            allowed_concepts=allowed_concepts,
            user_state=user_state,
        )
        ai_reply = result["reply"]
        # understanding_signals 반환
        understanding_signals = result.get("understanding_signals", [])
    except NotImplementedError:
        ai_reply = "AI 응답 생성 로직 연결 전입니다."
        understanding_signals = []

    # understanding_signals의 score_delta를 기존 score에 누적하고 status 재산출 후 DB 반영
    # _legacy_score_to_status(diagnosis_ai.py) 와 동일한 기준
    updated_nodes = []
    for signal in understanding_signals:
        node_id = signal.get("node_id")
        node = node_map.get(node_id)
        if not node:
            continue
        current_score = node.understanding_score or 0.0
        new_score = max(0.0, min(1.0, current_score + signal.get("score_delta", 0.0)))
        if new_score <= 0.0:
            new_status = "WEAK"
        elif new_score < 0.4:
            new_status = "PARTIAL"
        elif new_score < 0.8:
            new_status = "FAMILIAR"
        else:
            new_status = "MASTERED"
        graph_service.update_node_score(node_id, new_score, new_status, db)
        updated_nodes.append({"node_id": node_id, "score": new_score, "status": new_status})

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
        "updated_nodes": updated_nodes,  # [{"node_id": str, "score": float, "status": str}, ...]
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
