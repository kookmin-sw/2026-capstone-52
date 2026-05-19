import json
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.chat import Chat, ChatSession
from app.models.deferred_mini_quiz import DeferredMiniQuiz
from app.models.diagnosis import DiagnosisAnswer, DiagnosisQuestion
from app.models.graph import ConceptNode
from app.ai.diagnosis_ai import (
    QuestionValidationError,
    evaluate_answer,
    generate_question,
    score_to_level,
)
from app.services.diagnosis_service import apply_evaluation_to_nodes, create_diagnosis_question
from app.services.concept_quiz_counter_service import reset_concept_quiz_counter


MINI_QUIZ_RESULT_USER_MESSAGE = "미니퀴즈 결과"
MINI_QUIZ_RESULT_RESPONSE_TYPE = "mini_quiz_result"
MINI_QUIZ_GROUP_SIZE = 2
MINI_QUIZ_GENERATION_MAX_ATTEMPTS = 5

STATUS_LABELS = {
    "MASTERED": "양호",
    "FAMILIAR": "보통 이상",
    "PARTIAL": "보완 필요",
    "WEAK": "보완 필요",
    "UNSEEN": "미진단",
}


def _build_question_context(project_id: int, node: ConceptNode, db: Session) -> tuple[dict, dict]:
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
    return graph_context, target_concept


def _generate_one_question(
    node: ConceptNode,
    target_concept: dict,
    graph_context: dict,
    subject_id: str,
    db: Session,
) -> dict:
    """단일 문제 생성 — reuse_key는 DB에서 최신 조회하여 중복 출제 방지"""
    previous_reuse_keys = [
        q.reuse_key
        for q in db.query(DiagnosisQuestion).filter(
            DiagnosisQuestion.concept_id == node.node_id,
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
        explanation=_build_question_explanation(teacher_question),
    )

    return _serialize_question(q, node, teacher_choices)


def _serialize_question(q: DiagnosisQuestion, node: ConceptNode, choices: list[dict] | None = None) -> dict:
    teacher_choices = choices if choices is not None else (json.loads(q.choices) if q.choices else [])
    return {
        "question_id": q.question_id,
        "concept_id": q.concept_id,
        "concept_name": node.name,
        "difficulty": q.difficulty,
        "question_type": q.question_type,
        "diagnosis_purpose": q.diagnosis_purpose,
        "question": q.question,
        "choices": [
            {"id": choice["option_id"], "option_id": choice["option_id"], "text": choice["text"]}
            for choice in teacher_choices
        ],
    }


def _build_question_explanation(teacher_question: dict) -> str:
    explanations = []
    for choice in teacher_question.get("choices", []):
        if not isinstance(choice, dict):
            continue
        option_id = choice.get("option_id")
        text = choice.get("text")
        explanation = choice.get("explanation")
        if option_id and explanation:
            explanations.append(f"{option_id}. {text}: {explanation}" if text else f"{option_id}. {explanation}")

    if explanations:
        return "\n".join(explanations)
    return str(teacher_question.get("llm_reason") or "").strip()


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

    graph_context, target_concept = _build_question_context(project_id, node, db)

    questions = []
    last_error: Exception | None = None
    attempts = 0
    while len(questions) < MINI_QUIZ_GROUP_SIZE and attempts < MINI_QUIZ_GENERATION_MAX_ATTEMPTS:
        attempts += 1
        try:
            questions.append(_generate_one_question(node, target_concept, graph_context, subject_id, db))
        except QuestionValidationError as error:
            last_error = error
            continue

    if len(questions) < MINI_QUIZ_GROUP_SIZE:
        raise ValueError(f"미니퀴즈 2문항을 생성할 수 없습니다: {last_error}")

    reset_concept_quiz_counter(db, project_id, node_id)
    db.commit()

    return {
        "group": {
            "node_id": node.node_id,
            "node_name": node.name,
            "question_ids": [q["question_id"] for q in questions],
        },
        "questions": questions,
    }


def defer_mini_quiz_question(
    project_id: int,
    node_id: str | None,
    db: Session,
    question_ids: list[str] | None = None,
) -> dict:
    """나중에 풀기 — 이미 생성된 2문항을 우선 저장하고, 없으면 legacy 방식으로 생성"""
    if question_ids:
        result = _load_existing_question_group(project_id, question_ids, db)
        resolved_node_id = result["group"]["node_id"]
    else:
        if not node_id:
            raise ValueError("node_id 또는 question_ids가 필요합니다.")
        result = generate_mini_quiz_question(project_id, node_id, db)
        resolved_node_id = node_id

    deferred_at = datetime.now(timezone.utc)
    for q in result["questions"]:
        existing = db.query(DeferredMiniQuiz).filter(
            DeferredMiniQuiz.project_id == project_id,
            DeferredMiniQuiz.question_id == q["question_id"],
            DeferredMiniQuiz.status == "PENDING",
        ).first()
        if existing:
            continue
        deferred = DeferredMiniQuiz(
            project_id=project_id,
            node_id=resolved_node_id,
            question_id=q["question_id"],
            status="PENDING",
            created_at=deferred_at,
        )
        db.add(deferred)

    reset_concept_quiz_counter(db, project_id, resolved_node_id)
    db.commit()

    return result


def get_deferred_mini_quizzes(project_id: int, db: Session) -> list[dict]:
    """프로젝트의 미뤄둔 퀴즈를 2문항 group 단위로 반환 (PENDING 상태만)"""
    rows = (
        db.query(DeferredMiniQuiz, DiagnosisQuestion, ConceptNode)
        .join(DiagnosisQuestion, DiagnosisQuestion.question_id == DeferredMiniQuiz.question_id)
        .join(ConceptNode, ConceptNode.node_id == DeferredMiniQuiz.node_id)
        .filter(
            DeferredMiniQuiz.project_id == project_id,
            DeferredMiniQuiz.status == "PENDING",
        )
        .order_by(DeferredMiniQuiz.created_at.asc())
        .all()
    )

    grouped: dict[tuple[str, datetime], dict] = {}
    for deferred, question, node in rows:
        choices = json.loads(question.choices) if question.choices else []
        item = {
            "deferred_id": deferred.id,
            "question_id": question.question_id,
            "node_id": node.node_id,
            "node_name": node.name,
            "question": question.question,
            "choices": [{"option_id": c["option_id"], "text": c["text"]} for c in choices],
            "deferred_at": deferred.created_at,
        }
        key = (node.node_id, deferred.created_at)
        group = grouped.setdefault(
            key,
            {
                "group_id": f"{node.node_id}:{deferred.created_at.isoformat()}",
                "node_id": node.node_id,
                "node_name": node.name,
                "question_ids": [],
                "questions": [],
                "deferred_at": deferred.created_at,
            },
        )
        group["question_ids"].append(question.question_id)
        group["questions"].append(item)

    return list(grouped.values())


def _load_existing_question_group(project_id: int, question_ids: list[str], db: Session) -> dict:
    if len(question_ids) != MINI_QUIZ_GROUP_SIZE:
        raise ValueError("미니퀴즈 group은 정확히 2개의 question_id가 필요합니다.")

    questions = (
        db.query(DiagnosisQuestion)
        .filter(DiagnosisQuestion.question_id.in_(question_ids))
        .all()
    )
    question_by_id = {q.question_id: q for q in questions}
    if len(question_by_id) != len(set(question_ids)):
        raise ValueError("존재하지 않는 question_id가 포함되어 있습니다.")

    ordered_questions = [question_by_id[qid] for qid in question_ids]
    node_ids = {q.concept_id for q in ordered_questions}
    if len(node_ids) != 1:
        raise ValueError("하나의 미니퀴즈 group은 같은 개념의 문제만 포함할 수 있습니다.")

    node = db.query(ConceptNode).filter(ConceptNode.node_id == ordered_questions[0].concept_id).first()
    if not node or node.project_id != project_id:
        raise ValueError("해당 프로젝트의 미니퀴즈 문제가 아닙니다.")

    return {
        "group": {
            "node_id": node.node_id,
            "node_name": node.name,
            "question_ids": question_ids,
        },
        "questions": [_serialize_question(q, node) for q in ordered_questions],
    }


def submit_mini_quiz_group(
    project_id: int,
    user_id: int,
    answers: list[dict],
    db: Session,
    session_id: int | None = None,
) -> dict:
    if len(answers) != MINI_QUIZ_GROUP_SIZE:
        raise ValueError("미니퀴즈 group 제출은 정확히 2개의 답변이 필요합니다.")

    evaluated_items = [
        _evaluate_mini_quiz_answer(
            project_id=project_id,
            question_id=answer["question_id"],
            selected_option_ids=answer.get("selected_option_ids"),
            is_skipped=answer.get("is_skipped", False),
            db=db,
        )
        for answer in answers
    ]

    node_ids = {item["node"].node_id for item in evaluated_items}
    if len(node_ids) != 1:
        raise ValueError("하나의 미니퀴즈 group은 같은 개념의 답변만 포함할 수 있습니다.")

    node = evaluated_items[0]["node"]
    previous_status = node.status or "UNSEEN"
    previous_level = node.understanding_level
    group_score = round(
        sum(item["evaluation"]["answer_score"] for item in evaluated_items) / len(evaluated_items),
        4,
    )

    for item in evaluated_items:
        _save_mini_quiz_answer(
            question_id=item["question"].question_id,
            evaluation=item["evaluation"],
            is_skipped=item["is_skipped"],
            db=db,
        )

    updated_nodes = apply_evaluation_to_nodes(
        node_ids=[node.node_id],
        answer_score=group_score,
        db=db,
    )
    updated_node = updated_nodes[0] if updated_nodes else None
    db.flush()
    db.refresh(node)

    reset_concept_quiz_counter(db, project_id, node.node_id)
    result_message = _create_mini_quiz_result_chat(
        db=db,
        user_id=user_id,
        project_id=project_id,
        session_id=session_id,
        node=node,
        previous_status=previous_status,
        previous_level=previous_level,
        is_fully_correct=all(item["evaluation"]["is_fully_correct"] for item in evaluated_items),
        group_score=group_score,
    )

    question_ids = [item["question"].question_id for item in evaluated_items]
    for deferred in db.query(DeferredMiniQuiz).filter(
        DeferredMiniQuiz.question_id.in_(question_ids),
        DeferredMiniQuiz.status == "PENDING",
    ).all():
        deferred.status = "COMPLETED"
        deferred.completed_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(result_message)

    question_results = [
        _build_question_result(item["question"], item["evaluation"])
        for item in evaluated_items
    ]

    return {
        "group_score": group_score,
        "updated_node": updated_node,
        "question_results": question_results,
        "result_message": _serialize_result_message(result_message),
        "group_result": {
            "node_id": node.node_id,
            "node_name": node.name,
            "question_ids": question_ids,
            "group_score": group_score,
            "updated_node": updated_node,
            "review": question_results,
        },
    }


def submit_mini_quiz_groups(
    project_id: int,
    user_id: int,
    groups: list[dict],
    db: Session,
    session_id: int | None = None,
) -> dict:
    return {
        "groups": [
            submit_mini_quiz_group(
                project_id=project_id,
                user_id=user_id,
                answers=group["answers"],
                db=db,
                session_id=session_id,
            )
            for group in groups
        ]
    }


def _evaluate_mini_quiz_answer(
    *,
    project_id: int,
    question_id: str,
    selected_option_ids: list[str] | None,
    is_skipped: bool,
    db: Session,
) -> dict:
    q = db.query(DiagnosisQuestion).filter(DiagnosisQuestion.question_id == question_id).first()
    if not q:
        raise ValueError("질문을 찾을 수 없습니다.")

    node = db.query(ConceptNode).filter(ConceptNode.node_id == q.concept_id).first()
    if not node:
        raise ValueError("해당 개념 노드를 찾을 수 없습니다.")
    if node.project_id != project_id:
        raise ValueError("해당 프로젝트의 미니 퀴즈가 아닙니다.")

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
            "feedback_tags": [],
        }
    else:
        evaluation = evaluate_answer(teacher_question, selected_option_ids or [])

    return {
        "question": q,
        "node": node,
        "evaluation": evaluation,
        "is_skipped": is_skipped,
    }


def _save_mini_quiz_answer(
    *,
    question_id: str,
    evaluation: dict,
    is_skipped: bool,
    db: Session,
) -> DiagnosisAnswer:
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
        feedback_tags=json.dumps(evaluation.get("feedback_tags", []), ensure_ascii=False),
    )
    db.add(answer)
    return answer


def _build_question_result(question: DiagnosisQuestion, evaluation: dict) -> dict:
    return {
        "question_id": question.question_id,
        "concept_id": question.concept_id,
        "question": question.question,
        "selected_option_ids": evaluation["selected_option_ids"],
        "correct_option_ids": evaluation["correct_option_ids"],
        "missed_correct_option_ids": evaluation["missed_correct_option_ids"],
        "wrong_selected_option_ids": evaluation["wrong_selected_option_ids"],
        "invalid_selected_option_ids": evaluation.get("invalid_selected_option_ids", []),
        "is_fully_correct": evaluation["is_fully_correct"],
        "partial_score": evaluation["partial_score"],
        "answer_score": evaluation["answer_score"],
        "explanation": question.explanation,
    }


def submit_mini_quiz_answer(
    project_id: int,
    user_id: int,
    question_id: str,
    selected_option_ids: list[str] | None,
    is_skipped: bool,
    db: Session,
    session_id: int | None = None,
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
        feedback_tags=json.dumps(evaluation.get("feedback_tags", []), ensure_ascii=False),
    )
    db.add(answer)

    reset_concept_quiz_counter(db, project_id, q.concept_id)
    result_message = _create_mini_quiz_result_chat(
        db=db,
        user_id=user_id,
        project_id=project_id,
        session_id=session_id,
        node=node,
        previous_status=previous_status,
        previous_level=previous_level,
        is_fully_correct=evaluation["is_fully_correct"],
    )

    # 미뤄둔 퀴즈였으면 완료 처리
    deferred = db.query(DeferredMiniQuiz).filter(
        DeferredMiniQuiz.question_id == question_id,
        DeferredMiniQuiz.status == "PENDING",
    ).first()
    if deferred:
        deferred.status = "COMPLETED"
        deferred.completed_at = datetime.now(timezone.utc)

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
    session_id: int | None = None,
    node: ConceptNode,
    previous_status: str,
    previous_level: int | None,
    is_fully_correct: bool,
    group_score: float | None = None,
) -> Chat:
    message = _build_mini_quiz_result_message(
        node=node,
        previous_status=previous_status,
        previous_level=previous_level,
        is_fully_correct=is_fully_correct,
        group_score=group_score,
    )
    chat = Chat(
        user_id=user_id,
        project_id=project_id,
        session_id=session_id,
        user_message=MINI_QUIZ_RESULT_USER_MESSAGE,
        ai_response=message,
        response_type=MINI_QUIZ_RESULT_RESPONSE_TYPE,
    )
    db.add(chat)
    if session_id is not None:
        session = (
            db.query(ChatSession)
            .filter(ChatSession.project_id == project_id, ChatSession.id == session_id)
            .first()
        )
        if session:
            session.updated_at = datetime.now(timezone.utc)
    db.flush()
    return chat


def _build_mini_quiz_result_message(
    *,
    node: ConceptNode,
    previous_status: str,
    previous_level: int | None,
    is_fully_correct: bool,
    group_score: float | None = None,
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

    score_sentence = f"\n그룹 점수: **{group_score:.2f}**" if group_score is not None else ""

    return (
        "방금 푼 미니퀴즈 결과를 반영했어요.\n\n"
        f"개념: **{concept_name}**\n"
        f"{status_sentence}"
        f"{level_sentence}"
        f"{score_sentence}\n\n"
        f"{next_step}"
    )


def _status_label(status: str) -> str:
    return STATUS_LABELS.get(status, "보완 필요")


def _serialize_result_message(chat: Chat) -> dict:
    return {
        "chat_id": chat.chat_id,
        "project_id": chat.project_id,
        "session_id": chat.session_id,
        "user_message": chat.user_message,
        "ai_response": chat.ai_response,
        "response_type": chat.response_type,
        "created_at": chat.created_at,
    }
