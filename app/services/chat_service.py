from sqlalchemy.orm import Session

from app.models.chat import Chat
from app.models.learning_log import LearningLog
from app.schemas.chat import ChatRequest


def save_chat(
    db: Session,
    project_id: int,
    chat_data: ChatRequest,
    ai_response: str,
    user_id: int | None = None,
):
    resolved_user_id = user_id if user_id is not None else chat_data.user_id

    if resolved_user_id is None:
        raise ValueError("user_id가 필요합니다.")

    chat = Chat(
        user_id=resolved_user_id,
        project_id=project_id,
        user_message=chat_data.message,
        ai_response=ai_response,
        response_type=chat_data.response_type,
    )

    db.add(chat)
    db.commit()
    db.refresh(chat)

    log = LearningLog(
        user_id=resolved_user_id,
        project_id=project_id,
        activity_type="explanation_requested",
        activity_summary="맞춤 설명을 요청했습니다."
    )

    db.add(log)
    db.commit()

    return chat


def get_chats_by_project(db: Session, project_id: int):
    return (
        db.query(Chat)
        .filter(Chat.project_id == project_id)
        .order_by(Chat.created_at.asc())
        .all()
    )
