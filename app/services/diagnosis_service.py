# 수준 진단 서비스 — 질문 생성, 답변 저장, score 노드 반영
#
# score 계산 및 status 변환은 AI 레이어(diagnosis_ai.calculate_score)에서 담당
# 서비스는 AI 결과를 받아 concept_nodes에 저장하는 역할만 함

import json
import uuid
from sqlalchemy.orm import Session
from app.models.graph import ConceptNode, ConceptEdge
from app.models.diagnosis import DiagnosisQuestion, DiagnosisAnswer
from app.ai.diagnosis_ai import (
    DiagnosisAIError,
    QuestionValidationError,
    evaluate_answer,
    generate_question,
    score_to_level,
)


# ── 세션 ──────────────────────────────────────────────────────────────────────

def create_session_id() -> str:
    """새 진단 세션 ID 발급 — PDF 업로드 시마다 호출해서 1차/2차 진단을 구분"""
    return str(uuid.uuid4())


# ── 질문 ──────────────────────────────────────────────────────────────────────

def create_diagnosis_question(
    concept_id: str,
    difficulty: str,
    question_type: str,
    question: str,
    choices: list,
    correct_index: int,
    db: Session,
    correct_option_ids: list[str] | None = None,
    diagnostic_tags: list[str] | None = None,
    tag_group: str | None = None,
    reuse_key: str | None = None,
    diagnosis_purpose: str | None = None,
    explanation: str | None = None,
) -> DiagnosisQuestion:
    """AI 모듈 결과로 진단 질문 생성 및 저장"""
    q = DiagnosisQuestion(
        concept_id=concept_id,
        difficulty=difficulty,
        question_type=question_type,
        question=question,
        choices=json.dumps(choices, ensure_ascii=False),
        correct_index=correct_index,
        correct_option_ids=json.dumps(correct_option_ids, ensure_ascii=False) if correct_option_ids is not None else None,
        diagnostic_tags=json.dumps(diagnostic_tags, ensure_ascii=False) if diagnostic_tags is not None else None,
        tag_group=tag_group,
        reuse_key=reuse_key,
        diagnosis_purpose=diagnosis_purpose,
        explanation=explanation,
    )
    db.add(q)
    db.commit()
    db.refresh(q)
    return q


def generate_next_question(project_id: int, db: Session, session_id: str | None = None) -> dict | None:
    """프로젝트 그래프에서 다음 진단 문항을 생성하고 teacher-side payload를 저장"""
    nodes = db.query(ConceptNode).filter(ConceptNode.project_id == project_id).all()
    if not nodes:
        return None

    latest_answer_context = _get_latest_answer_context(session_id, db)
    prerequisite_candidates: list[ConceptNode] = []
    if (
        latest_answer_context
        and latest_answer_context.get("answer_score") is not None
        and latest_answer_context["answer_score"] < LOW_SCORE_THRESHOLD
    ):
        prerequisite_candidates = _find_prerequisite_candidates(
            project_id=project_id,
            current_node_id=latest_answer_context["concept_node_id"],
            db=db,
        )

    graph_context = {
        "project_id": project_id,
        "concepts": [
            {
                "concept_id": node.concept_id or node.node_id,
                "concept_name": node.name,
                "group": node.group,
                "understanding_score": node.understanding_score,
                "is_core": node.is_core,
            }
            for node in nodes
        ],
    }
    candidate_nodes = _build_candidate_nodes(nodes, prerequisite_candidates=prerequisite_candidates)
    if not candidate_nodes:
        return None

    last_error: Exception | None = None
    for target_node in candidate_nodes:
        subject_id = (target_node.subject_id or "").strip()
        if not subject_id:
            raise ValueError(f"subject_id is missing for ConceptNode.node_id='{target_node.node_id}'.")

        target_concept = {
            "node_id": target_node.node_id,
            "concept_id": target_node.concept_id or target_node.node_id,
            "concept_name": target_node.name,
            "name": target_node.name,
            "description": target_node.description,
            "group": target_node.group,
            "understanding_score": target_node.understanding_score,
            "understanding_level": target_node.understanding_level,
            "is_core": target_node.is_core,
            "core_score": target_node.core_score,
        }
        previous_reuse_keys = _get_previous_reuse_keys(target_node.node_id, db)

        try:
            teacher_question = generate_question(
                target_concept=target_concept,
                graph_context=graph_context,
                subject_id=subject_id,
                diagnosis_purpose="concept_check",
                question_difficulty="medium",
                previous_reuse_keys=previous_reuse_keys,
            )
        except QuestionValidationError as error:
            last_error = error
            continue
        except DiagnosisAIError:
            raise

        teacher_choices = teacher_question["choices"]
        q = create_diagnosis_question(
            concept_id=target_node.node_id,
            difficulty=teacher_question["question_difficulty"],
            question_type=teacher_question["question_type"],
            question=teacher_question["question_text"],
            choices=teacher_choices,
            correct_index=0,  # legacy non-null column — multi-select grading uses correct_option_ids
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
            "concept_name": target_node.name,
            "difficulty": q.difficulty,
            "question_type": q.question_type,
            "diagnosis_purpose": q.diagnosis_purpose,
            "question": q.question,
            "choices": [
                {
                    "id": choice["option_id"],
                    "option_id": choice["option_id"],
                    "text": choice["text"],
                }
                for choice in teacher_choices
            ],
        }

    if last_error is not None:
        raise ValueError(f"질문 중복으로 진단 문항을 생성할 수 없습니다: {last_error}")
    return None


# ── 답변 처리 ─────────────────────────────────────────────────────────────────

def submit_answer(
    question_id: str,
    session_id: str,
    selected_index: int | None,
    selected_option_ids: list[str] | None,
    is_skipped: bool,
    db: Session,
) -> dict | None:
    """답변 저장 → AI에 score 요청 → concept 노드에 반영

    반환:
    {
      "is_correct": bool,
      "correct_index": int,
      "updated_nodes": [{"node_id": str, "status": str, "understanding_score": float}, ...]
    }
    """
    q = db.query(DiagnosisQuestion).filter(DiagnosisQuestion.question_id == question_id).first()
    if not q:
        return None

    if q.correct_option_ids or q.question_type == "multi_select":
        primary_node = db.query(ConceptNode).filter(ConceptNode.node_id == q.concept_id).first()
        if not primary_node:
            raise ValueError(f"Primary ConceptNode not found for node_id='{q.concept_id}'.")

        concept_name = (primary_node.name or "").strip()
        subject_id = (primary_node.subject_id or "").strip()
        if not concept_name:
            raise ValueError(f"ConceptNode.name is missing for node_id='{q.concept_id}'.")
        if not subject_id:
            raise ValueError(f"ConceptNode.subject_id is missing for node_id='{q.concept_id}'.")

        teacher_question = {
            "concept_id": q.concept_id,
            "concept_name": concept_name,
            "subject_id": subject_id,
            "question_type": "multi_select",
            "diagnosis_purpose": q.diagnosis_purpose or "concept_check",
            "question_difficulty": q.difficulty,
            "question_text": q.question,
            "choices": _json_loads_list(q.choices),
            "correct_option_ids": _json_loads_list(q.correct_option_ids),
            "diagnostic_tags": _json_loads_list(q.diagnostic_tags),
            "tag_group": q.tag_group or "",
            "reuse_key": q.reuse_key or "",
        }

        if is_skipped:
            correct_option_ids = teacher_question["correct_option_ids"]
            evaluation = {
                "selected_option_ids": [],
                "valid_selected_option_ids": [],
                "invalid_selected_option_ids": [],
                "correct_option_ids": correct_option_ids,
                "correct_selected_option_ids": [],
                "missed_correct_option_ids": correct_option_ids,
                "wrong_selected_option_ids": [],
                "partial_score": 0.0,
                "answer_score": 0.0,
                "is_fully_correct": False,
                "answer_level": score_to_level(0.0),
                "selected_count": 0,
                "correct_count": len(correct_option_ids),
                "wrong_count": 0,
                "feedback_tags": [],
            }
        else:
            evaluation = evaluate_answer(teacher_question, selected_option_ids or [])

        answer = DiagnosisAnswer(
            question_id=question_id,
            session_id=session_id,
            is_correct=evaluation["is_fully_correct"],
            is_skipped=is_skipped,
            selected_option_ids=_json_dumps(evaluation["selected_option_ids"]),
            partial_score=evaluation["partial_score"],
            answer_score=evaluation["answer_score"],
            is_fully_correct=evaluation["is_fully_correct"],
            invalid_selected_option_ids=_json_dumps(evaluation["invalid_selected_option_ids"]),
            missed_correct_option_ids=_json_dumps(evaluation["missed_correct_option_ids"]),
            wrong_selected_option_ids=_json_dumps(evaluation["wrong_selected_option_ids"]),
            feedback_tags=_json_dumps(evaluation.get("feedback_tags", [])),
        )
        db.add(answer)
        db.flush()

        updated_nodes = apply_evaluation_to_nodes(
            node_ids=[q.concept_id],
            answer_score=evaluation["answer_score"],
            db=db,
        )

        db.commit()
        return {
            "is_correct": evaluation["is_fully_correct"],
            "correct_index": q.correct_index,
            "is_fully_correct": evaluation["is_fully_correct"],
            "partial_score": evaluation["partial_score"],
            "answer_score": evaluation["answer_score"],
            "answer_level": evaluation["answer_level"],
            "correct_option_ids": evaluation["correct_option_ids"],
            "selected_option_ids": evaluation["selected_option_ids"],
            "missed_correct_option_ids": evaluation["missed_correct_option_ids"],
            "wrong_selected_option_ids": evaluation["wrong_selected_option_ids"],
            "invalid_selected_option_ids": evaluation["invalid_selected_option_ids"],
            "updated_nodes": updated_nodes,
        }

    raise ValueError("구형 단일 선택 문제 포맷은 지원하지 않습니다.")


def apply_evaluation_to_nodes(
    node_ids: list[str],
    answer_score: float,
    db: Session,
) -> list[dict]:
    results = []

    for node_id in sorted(set(node_ids)):
        node = db.query(ConceptNode).filter(ConceptNode.node_id == node_id).first()
        if not node:
            continue

        previous_score = node.understanding_score if node.understanding_score is not None else 0.5
        new_score = _clamp(0.7 * previous_score + 0.3 * answer_score, 0.0, 1.0)

        node.understanding_score = new_score
        node.understanding_level = score_to_level(new_score)
        node.confidence = min((node.confidence or 0.0) + 0.1, 1.0)
        node.diagnosis_count = (node.diagnosis_count or 0) + 1
        node.status = _legacy_status_from_score(new_score)

        results.append(
            {
                "node_id": node.node_id,
                "status": node.status,
                "understanding_score": node.understanding_score,
            }
        )

    return results



# ── 진행 상태 ─────────────────────────────────────────────────────────────────

TOTAL_QUESTIONS = 12
NODE_STATUS_UNSEEN = "UNSEEN"
NODE_STATUS_MASTERED = "MASTERED"
LOW_SCORE_THRESHOLD = 0.4


def get_diagnosis_node_list(project_id: int, question_id: str | None, db: Session) -> list[dict]:
    """진단 개념 목록 반환 — 우측 패널용

    diagnosis_label 규칙:
    - 현재 문제의 concept_id 노드 → 진행 중
    - status == UNSEEN → 미진단
    - status == MASTERED → 이해
    - 그 외 → 추가 학습
    """
    current_concept_id = None
    if question_id:
        q = db.query(DiagnosisQuestion).filter(DiagnosisQuestion.question_id == question_id).first()
        if q:
            current_concept_id = q.concept_id

    nodes = db.query(ConceptNode).filter(ConceptNode.project_id == project_id).all()
    result = []
    for node in nodes:
        if node.node_id == current_concept_id:
            label = "진행 중"
        elif node.status == NODE_STATUS_UNSEEN:
            label = "미진단"
        elif node.status == NODE_STATUS_MASTERED:
            label = "이해"
        else:
            label = "추가 학습"
        result.append({"node_id": node.node_id, "name": node.name, "diagnosis_label": label})
    return result


def get_diagnosis_status(session_id: str, db: Session) -> dict:
    """session_id 기준 진단 진행률 반환 — 문제 12개 고정"""
    answered = (
        db.query(DiagnosisAnswer)
        .filter(DiagnosisAnswer.session_id == session_id)
        .count()
    )
    progress = round(answered / TOTAL_QUESTIONS * 100, 1)
    return {
        "session_id": session_id,
        "answered": answered,
        "total_questions": TOTAL_QUESTIONS,
        "progress_percent": progress,
    }


def _json_loads_list(value: str | None) -> list:
    if not value:
        return []

    parsed = json.loads(value)
    if isinstance(parsed, list):
        return parsed
    raise ValueError("Expected JSON list value.")


def _json_dumps(value: list) -> str:
    return json.dumps(value, ensure_ascii=False)


def _legacy_status_from_score(score: float) -> str:
    if score <= 0.0:
        return "WEAK"
    if score < 0.4:
        return "PARTIAL"
    if score < 0.8:
        return "FAMILIAR"
    return "MASTERED"


def _clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(value, maximum))


def _get_previous_reuse_keys(target_node_id: str, db: Session) -> list[str]:
    questions = (
        db.query(DiagnosisQuestion)
        .filter(
            DiagnosisQuestion.concept_id == target_node_id,
            DiagnosisQuestion.reuse_key.isnot(None),
        )
        .all()
    )
    return [question.reuse_key for question in questions if question.reuse_key]


def _get_latest_answer_context(session_id: str | None, db: Session) -> dict | None:
    if not session_id:
        return None

    latest_answer = (
        db.query(DiagnosisAnswer)
        .filter(DiagnosisAnswer.session_id == session_id)
        .order_by(DiagnosisAnswer.created_at.desc())
        .first()
    )
    if not latest_answer:
        return None

    question = (
        db.query(DiagnosisQuestion)
        .filter(DiagnosisQuestion.question_id == latest_answer.question_id)
        .first()
    )
    if not question:
        return None

    answer_score = latest_answer.answer_score
    if answer_score is None:
        answer_score = latest_answer.partial_score

    return {
        "question": question,
        "answer": latest_answer,
        "answer_score": answer_score,
        "concept_node_id": question.concept_id,
    }


def _find_prerequisite_candidates(
    project_id: int,
    current_node_id: str,
    db: Session,
) -> list[ConceptNode]:
    edges = (
        db.query(ConceptEdge)
        .filter(
            ConceptEdge.project_id == project_id,
            ConceptEdge.relation_type == "prerequisite",
            ConceptEdge.edge_source_scope == "uploaded_material",
            ConceptEdge.target_node_id == current_node_id,
        )
        .all()
    )
    if not edges:
        return []

    prerequisite_node_ids = [edge.source_node_id for edge in edges]
    nodes = (
        db.query(ConceptNode)
        .filter(ConceptNode.node_id.in_(prerequisite_node_ids))
        .all()
    )
    node_map = {node.node_id: node for node in nodes}
    return [node_map[node_id] for node_id in prerequisite_node_ids if node_id in node_map]


def _build_candidate_nodes(
    nodes: list[ConceptNode],
    *,
    prerequisite_candidates: list[ConceptNode] | None = None,
) -> list[ConceptNode]:
    if prerequisite_candidates:
        unique_prerequisites = _dedupe_nodes(prerequisite_candidates)
        return sorted(
            unique_prerequisites,
            key=lambda node: (
                node.diagnosis_count if node.diagnosis_count is not None else 0,
                node.understanding_score if node.understanding_score is not None else 0.5,
                -(node.core_score if node.core_score is not None else 0.0),
            ),
        )

    return sorted(
        _dedupe_nodes(nodes),
        key=lambda node: (
            -(1 if node.is_core else 0),
            -(node.core_score if node.core_score is not None else 0.0),
            node.diagnosis_count if node.diagnosis_count is not None else 0,
            node.understanding_score if node.understanding_score is not None else 0.5,
        ),
    )


def _dedupe_nodes(nodes: list[ConceptNode]) -> list[ConceptNode]:
    unique_nodes: dict[str, ConceptNode] = {}
    for node in nodes:
        unique_nodes[node.node_id] = node
    return list(unique_nodes.values())


def get_node_quiz_history(node_id: str, db: Session) -> list[dict]:
    """노드에 출제된 모든 퀴즈 이력 반환 — 수준진단 + 미니퀴즈 통합"""
    questions = (
        db.query(DiagnosisQuestion)
        .filter(DiagnosisQuestion.concept_id == node_id)
        .order_by(DiagnosisQuestion.created_at.desc())
        .all()
    )
    result = []
    for q in questions:
        answer = (
            db.query(DiagnosisAnswer)
            .filter(DiagnosisAnswer.question_id == q.question_id)
            .order_by(DiagnosisAnswer.created_at.desc())
            .first()
        )
        choices = json.loads(q.choices) if q.choices else []
        correct_ids = json.loads(q.correct_option_ids) if q.correct_option_ids else []
        selected_ids = json.loads(answer.selected_option_ids) if answer and answer.selected_option_ids else []

        result.append({
            "question_id": q.question_id,
            "concept_id": q.concept_id,
            "question": q.question,
            "choices": [
                {
                    "option_id": c["option_id"],
                    "text": c["text"],
                    "is_correct": c.get("is_correct", False),
                    "is_selected": c["option_id"] in selected_ids,
                }
                for c in choices
            ],
            "correct_option_ids": correct_ids,
            "selected_option_ids": selected_ids,
            "is_fully_correct": answer.is_fully_correct if answer else None,
            "partial_score": answer.partial_score if answer else None,
            "answer_score": answer.answer_score if answer else None,
            "explanation": q.explanation,
        })
    return result


def get_session_review(session_id: str, db: Session) -> list[dict]:
    """세션의 모든 질문/답변/정답을 리뷰용으로 반환"""
    answers = (
        db.query(DiagnosisAnswer)
        .filter(DiagnosisAnswer.session_id == session_id)
        .order_by(DiagnosisAnswer.created_at)
        .all()
    )
    result = []
    for answer in answers:
        q = db.query(DiagnosisQuestion).filter(DiagnosisQuestion.question_id == answer.question_id).first()
        if not q:
            continue

        choices = json.loads(q.choices) if q.choices else []
        correct_ids = json.loads(q.correct_option_ids) if q.correct_option_ids else []
        selected_ids = json.loads(answer.selected_option_ids) if answer.selected_option_ids else []

        result.append({
            "question_id": q.question_id,
            "concept_id": q.concept_id,
            "question": q.question,
            "choices": [
                {
                    "option_id": c["option_id"],
                    "text": c["text"],
                    "is_correct": c.get("is_correct", False),
                    "is_selected": c["option_id"] in selected_ids,
                }
                for c in choices
            ],
            "correct_option_ids": correct_ids,
            "selected_option_ids": selected_ids,
            "is_fully_correct": answer.is_fully_correct,
            "partial_score": answer.partial_score,
            "answer_score": answer.answer_score,
            "explanation": q.explanation,
        })
    return result


def get_questions_review(question_ids: list[str], db: Session) -> list[dict]:
    """question_id 목록으로 리뷰 데이터 반환 — 미니 퀴즈용"""
    result = []
    for question_id in question_ids:
        q = db.query(DiagnosisQuestion).filter(DiagnosisQuestion.question_id == question_id).first()
        if not q:
            continue

        answer = (
            db.query(DiagnosisAnswer)
            .filter(DiagnosisAnswer.question_id == question_id)
            .order_by(DiagnosisAnswer.created_at.desc())
            .first()
        )

        choices = json.loads(q.choices) if q.choices else []
        correct_ids = json.loads(q.correct_option_ids) if q.correct_option_ids else []
        selected_ids = json.loads(answer.selected_option_ids) if answer and answer.selected_option_ids else []

        result.append({
            "question_id": q.question_id,
            "concept_id": q.concept_id,
            "question": q.question,
            "choices": [
                {
                    "option_id": c["option_id"],
                    "text": c["text"],
                    "is_correct": c.get("is_correct", False),
                    "is_selected": c["option_id"] in selected_ids,
                }
                for c in choices
            ],
            "correct_option_ids": correct_ids,
            "selected_option_ids": selected_ids,
            "is_fully_correct": answer.is_fully_correct if answer else None,
            "partial_score": answer.partial_score if answer else None,
            "answer_score": answer.answer_score if answer else None,
            "explanation": q.explanation,
        })
    return result

