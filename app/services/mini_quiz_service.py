import json

from sqlalchemy.orm import Session

from app.models.chat import Chat
from app.models.diagnosis import DiagnosisAnswer, DiagnosisQuestion
from app.models.graph import ConceptNode
from app.ai.diagnosis_ai import (
    evaluate_answer,
    generate_question,
    score_to_level,
)
from app.services.diagnosis_service import apply_evaluation_to_nodes, create_diagnosis_question
from app.services.concept_quiz_counter_service import reset_concept_quiz_counter


MINI_QUIZ_RESULT_USER_MESSAGE = "미니퀴즈 결과"
MINI_QUIZ_RESULT_RESPONSE_TYPE = "mini_quiz_result"

STATUS_LABELS = {
    "MASTERED": "양호",
    "FAMILIAR": "보통 이상",
    "PARTIAL": "보완 필요",
    "WEAK": "보완 필요",
    "UNSEEN": "미진단",
}


def generate_mini_quiz_question(project_id: int, node_id: str, db: Session) -> dict:
    node = db.query(ConceptNode).filter(
        ConceptNode.node_id == node_id,
        ConceptNode.project_id == project_id,
    ).first()
    if not node:
        raise ValueError("노드를 찾을 수 없습니다.")

    subject_id = (node.subject_id or "").strip()
    if not subject_id:
        raise ValueError(f"노드에 subject_id가 없습니다: {node_id}")

    nodes = db.query(ConceptNode).filter(ConceptNode.project_id == project_id).all()
    graph_context = {
        "project_id": project_id,
        "concepts": [
            {
                "concept_id": n.concept_id or n.node_id,
                "concept_name": n.name,
                "group": n.group,
                "understanding_score": n.understanding_score,
                "is_core": n.is_core,
            }
            for n in nodes
        ],
    }
    target_concept = {
        "node_id": node.node_id,
        "concept_id": node.concept_id or node.node_id,
        "concept_name": node.name,
        "name": node.name,
        "description": node.description,
        "group": node.group,
        "understanding_score": node.understanding_score,
        "understanding_level": node.understanding_level,
        "is_core": node.is_core,
        "core_score": node.core_score,
    }

    previous_reuse_keys = [
        q.reuse_key
        for q in db.query(DiagnosisQuestion).filter(
            DiagnosisQuestion.concept_id == node_id,
            DiagnosisQuestion.reuse_key.isnot(None),
        ).all()
        if q.reuse_key
    ]

    teacher_question = generate_question(
        target_concept=target_concept,
        graph_context=graph_context,
        subject_id=subject_id,
        diagnosis_purpose="concept_check",
        question_difficulty="medium",
        previous_reuse_keys=previous_reuse_keys,
    )

    teacher_choices = teacher_question["choices"]
    q = create_diagnosis_question(
        concept_id=node.node_id,
        difficulty=teacher_question["question_difficulty"],
        question_type=teacher_question["question_type"],
        question=teacher_question["question_text"],
        choices=teacher_choices,
        correct_index=0,
        db=db,
        correct_option_ids=teacher_question["correct_option_ids"],
        diagnostic_tags=teacher_question["diagnostic_tags"],
        tag_group=teacher_question["tag_group"],
        reuse_key=teacher_question["reuse_key"],
        diagnosis_purpose=teacher_question["diagnosis_purpose"],
    )

    return {
        "question_id": q.question_id,
        "concept_id": q.concept_id,
        "difficulty": q.difficulty,
        "question_type": q.question_type,
        "diagnosis_purpose": q.diagnosis_purpose,
        "question": q.question,
        "choices": [
            {"option_id": choice["option_id"], "text": choice["text"]}
            for choice in teacher_choices
        ],
    }


def submit_mini_quiz_answer(
    project_id: int,
    user_id: int,
    question_id: str,
    selected_option_ids: list[str] | None,
    is_skipped: bool,
    db: Session,
) -> dict | None:
    q = db.query(DiagnosisQuestion).filter(DiagnosisQuestion.question_id == question_id).first()
    if not q:
        return None

    node = db.query(ConceptNode).filter(ConceptNode.node_id == q.concept_id).first()
    if not node:
        raise ValueError("해당 개념 노드를 찾을 수 없습니다.")
    if node.project_id != project_id:
        raise ValueError("해당 프로젝트의 미니 퀴즈가 아닙니다.")

    previous_status = node.status or "UNSEEN"
    previous_level = node.understanding_level

    choices = json.loads(q.choices) if q.choices else []
    correct_option_ids = json.loads(q.correct_option_ids) if q.correct_option_ids else []
    diagnostic_tags = json.loads(q.diagnostic_tags) if q.diagnostic_tags else ["general"]

    teacher_question = {
        "concept_id": q.concept_id,
        "concept_name": node.name or q.concept_id,
        "subject_id": node.subject_id or "",
        "question_type": "multi_select",
        "diagnosis_purpose": q.diagnosis_purpose or "concept_check",
        "question_difficulty": q.difficulty or "medium",
        "question_text": q.question,
        "choices": choices,
        "correct_option_ids": correct_option_ids,
        "diagnostic_tags": diagnostic_tags,
        "tag_group": q.tag_group or "general",
        "reuse_key": q.reuse_key or "",
    }

    if is_skipped:
        evaluation = {
            "selected_option_ids": [],
            "invalid_selected_option_ids": [],
            "correct_option_ids": correct_option_ids,
            "missed_correct_option_ids": correct_option_ids,
            "wrong_selected_option_ids": [],
            "partial_score": 0.0,
            "answer_score": 0.0,
            "is_fully_correct": False,
            "answer_level": score_to_level(0.0),
        }
    else:
        evaluation = evaluate_answer(teacher_question, selected_option_ids or [])

    # 노드 score 갱신 (수준 진단과 동일한 방식)
    updated_nodes = apply_evaluation_to_nodes(
        node_ids=[q.concept_id],
        answer_score=evaluation["answer_score"],
        db=db,
    )
    updated_node = updated_nodes[0] if updated_nodes else None
    db.flush()
    db.refresh(node)

    # 답변 저장 (리뷰 조회용)
    answer = DiagnosisAnswer(
        question_id=question_id,
        session_id="mini_quiz",
        is_correct=evaluation["is_fully_correct"],
        is_skipped=is_skipped,
        selected_option_ids=json.dumps(evaluation["selected_option_ids"], ensure_ascii=False),
        partial_score=evaluation["partial_score"],
        answer_score=evaluation["answer_score"],
        is_fully_correct=evaluation["is_fully_correct"],
        missed_correct_option_ids=json.dumps(evaluation["missed_correct_option_ids"], ensure_ascii=False),
        wrong_selected_option_ids=json.dumps(evaluation["wrong_selected_option_ids"], ensure_ascii=False),
        invalid_selected_option_ids=json.dumps(evaluation.get("invalid_selected_option_ids", []), ensure_ascii=False),
    )
    db.add(answer)

    reset_concept_quiz_counter(db, project_id, q.concept_id)
    result_message = _create_mini_quiz_result_chat(
        db=db,
        user_id=user_id,
        project_id=project_id,
        node=node,
        previous_status=previous_status,
        previous_level=previous_level,
        is_fully_correct=evaluation["is_fully_correct"],
    )

    db.commit()
    db.refresh(result_message)

    return {
        "is_fully_correct": evaluation["is_fully_correct"],
        "partial_score": evaluation["partial_score"],
        "answer_score": evaluation["answer_score"],
        "answer_level": evaluation["answer_level"],
        "correct_option_ids": evaluation["correct_option_ids"],
        "selected_option_ids": evaluation["selected_option_ids"],
        "missed_correct_option_ids": evaluation["missed_correct_option_ids"],
        "wrong_selected_option_ids": evaluation["wrong_selected_option_ids"],
        "invalid_selected_option_ids": evaluation["invalid_selected_option_ids"],
        "updated_node": updated_node,
        "result_message": _serialize_result_message(result_message),
    }


def _create_mini_quiz_result_chat(
    *,
    db: Session,
    user_id: int,
    project_id: int,
    node: ConceptNode,
    previous_status: str,
    previous_level: int | None,
    is_fully_correct: bool,
) -> Chat:
    message = _build_mini_quiz_result_message(
        node=node,
        previous_status=previous_status,
        previous_level=previous_level,
        is_fully_correct=is_fully_correct,
    )
    chat = Chat(
        user_id=user_id,
        project_id=project_id,
        user_message=MINI_QUIZ_RESULT_USER_MESSAGE,
        ai_response=message,
        response_type=MINI_QUIZ_RESULT_RESPONSE_TYPE,
    )
    db.add(chat)
    db.flush()
    return chat


def _build_mini_quiz_result_message(
    *,
    node: ConceptNode,
    previous_status: str,
    previous_level: int | None,
    is_fully_correct: bool,
) -> str:
    previous_label = _status_label(previous_status)
    current_status = node.status or "UNSEEN"
    current_label = _status_label(current_status)
    concept_name = node.name or "이 개념"

    if previous_label != current_label:
        status_sentence = f"이해 상태가 **{previous_label}**에서 **{current_label}**으로 바뀌었어요."
    else:
        status_sentence = f"현재 이해 상태는 **{current_label}**입니다."

    if current_status in {"WEAK", "PARTIAL"}:
        next_step = "아직 헷갈릴 수 있는 개념이에요. 이어서 예시 중심으로 다시 질문해보는 걸 추천해요."
    elif is_fully_correct:
        next_step = "이번 개념은 안정적으로 이해하고 있어요. 이제 연결된 개념과 비교하면서 정리하면 더 잘 기억될 거예요."
    else:
        next_step = "큰 흐름은 잡혀 있어요. 헷갈렸던 선택지를 해설로 확인한 뒤 관련 개념을 한 번 더 연결해보면 좋아요."

    level_sentence = ""
    if previous_level is not None and node.understanding_level is not None and previous_level != node.understanding_level:
        level_sentence = f"\n이해 단계도 {previous_level}단계에서 {node.understanding_level}단계로 조정됐어요."

    return (
        "방금 푼 미니퀴즈 결과를 반영했어요.\n\n"
        f"개념: **{concept_name}**\n"
        f"{status_sentence}"
        f"{level_sentence}\n\n"
        f"{next_step}"
    )


def _status_label(status: str) -> str:
    return STATUS_LABELS.get(status, "보완 필요")


def _serialize_result_message(chat: Chat) -> dict:
    return {
        "chat_id": chat.chat_id,
        "project_id": chat.project_id,
        "user_message": chat.user_message,
        "ai_response": chat.ai_response,
        "response_type": chat.response_type,
        "created_at": chat.created_at,
    }
