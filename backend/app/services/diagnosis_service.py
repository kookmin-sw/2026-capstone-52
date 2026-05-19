# 수준 진단 서비스 — 질문 생성, 답변 저장, score 노드 반영
#
# score 계산 및 status 변환은 AI 레이어(diagnosis_ai.calculate_score)에서 담당
# 서비스는 AI 결과를 받아 concept_nodes에 저장하는 역할만 함

import json
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from sqlalchemy.orm import Session
from app.models.file import File
from app.models.graph import ConceptNode, ConceptEdge
from app.models.diagnosis import DiagnosisQuestion, DiagnosisAnswer, DiagnosisSession
from app.ai.diagnosis_ai import (
    DiagnosisAIError,
    QuestionValidationError,
    evaluate_answer,
    generate_question,
    score_to_level,
)


# ── 세션 ──────────────────────────────────────────────────────────────────────

def create_diagnosis_session(project_id: int, file_id: str | None, db: Session) -> str:
    """새 진단 세션 생성 — file_id와 연결해서 파일 단위 진단 관리"""
    session_id = str(uuid.uuid4())
    db.add(DiagnosisSession(session_id=session_id, project_id=project_id, file_id=file_id))
    db.commit()
    return session_id


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
    """프로젝트 그래프에서 다음 진단 문항을 생성하거나 저장된 미응답 문항을 반환"""
    # hard cap: 세션 내 답변 수가 TOTAL_QUESTIONS에 도달하면 더 이상 생성하지 않음
    if session_id:
        answered_count = _get_answered_count(session_id, db)
        if answered_count >= TOTAL_QUESTIONS:
            return None

    diagnosed_file_ids = {
        row.file_id
        for row in db.query(File.file_id)
        .filter(File.project_id == project_id, File.diagnosis_status == "DIAGNOSED")
        .all()
        if row.file_id
    }
    nodes = [
        n for n in db.query(ConceptNode).filter(ConceptNode.project_id == project_id).all()
        if n.node_source != "root" and n.file_id not in diagnosed_file_ids
    ]
    if not nodes:
        return None

    core_nodes = _get_core_candidate_nodes(nodes)
    if not core_nodes:
        return None

    graph_context = _build_graph_context(project_id, nodes)
    _ensure_core_questions_generated(
        project_id=project_id,
        core_nodes=core_nodes,
        graph_context=graph_context,
        session_id=session_id,
        db=db,
    )

    next_core_question = _get_next_unanswered_question_for_nodes(
        nodes=core_nodes,
        session_id=session_id,
        db=db,
        diagnosis_purpose="concept_check",
    )
    if next_core_question:
        return _question_to_response(next_core_question[0], next_core_question[1])

    next_followup_question = _get_next_unanswered_question_for_nodes(
        nodes=_dedupe_nodes(nodes),
        session_id=session_id,
        db=db,
        diagnosis_purpose="prerequisite_check",
    )
    if next_followup_question:
        return _question_to_response(next_followup_question[0], next_followup_question[1])

    # 백그라운드 followup 생성이 아직 완료되지 않았거나 전혀 생성되지 않은 경우 동기 fallback
    if session_id:
        _ensure_followup_questions_for_session(project_id, session_id, nodes, db)
        next_followup_question = _get_next_unanswered_question_for_nodes(
            nodes=_dedupe_nodes(nodes),
            session_id=session_id,
            db=db,
            diagnosis_purpose="prerequisite_check",
        )
        if next_followup_question:
            return _question_to_response(next_followup_question[0], next_followup_question[1])

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
            "needs_followup": evaluation["answer_score"] < LOW_SCORE_THRESHOLD,
            "weak_node_id": q.concept_id,
            "project_id": primary_node.project_id,
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

    diagnosed_file_ids = {
        row.file_id
        for row in db.query(File.file_id)
        .filter(File.project_id == project_id, File.diagnosis_status == "DIAGNOSED")
        .all()
        if row.file_id
    }
    nodes = [
        n for n in db.query(ConceptNode).filter(
            ConceptNode.project_id == project_id,
            ConceptNode.node_source != "root",
        ).all()
        if n.file_id not in diagnosed_file_ids
    ]
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


def pregenerate_core_questions(project_id: int, file_id: str, db: Session) -> None:
    """PDF 분석 완료 시점에 핵심 개념 문제 병렬 생성 — 진단 시작 시 즉시 제공하기 위함"""
    diagnosed_file_ids = {
        row.file_id
        for row in db.query(File.file_id)
        .filter(File.project_id == project_id, File.diagnosis_status == "DIAGNOSED")
        .all()
        if row.file_id
    }
    nodes = [
        n for n in db.query(ConceptNode).filter(
            ConceptNode.project_id == project_id,
            ConceptNode.file_id == file_id,
        ).all()
        if n.node_source != "root" and n.file_id not in diagnosed_file_ids
    ]
    if not nodes:
        return

    core_nodes = _get_core_candidate_nodes(nodes)
    if not core_nodes:
        return

    all_nodes = db.query(ConceptNode).filter(ConceptNode.project_id == project_id).all()
    graph_context = _build_graph_context(project_id, all_nodes)

    target_node_ids = [
        node.node_id for node in core_nodes
        if not _has_question_for_node(node.node_id, db, diagnosis_purpose="concept_check")
    ]
    if not target_node_ids:
        return

    with ThreadPoolExecutor(max_workers=len(target_node_ids)) as executor:
        futures = [
            executor.submit(_pregenerate_single_node, project_id, node_id, graph_context)
            for node_id in target_node_ids
        ]
        for future in as_completed(futures):
            try:
                future.result()
            except Exception:
                pass


def _pregenerate_single_node(project_id: int, node_id: str, graph_context: dict) -> None:
    """단일 노드 문제 생성 — 독립 DB 세션 사용 (ThreadPoolExecutor 병렬 처리용)"""
    from app.db.session import SessionLocal
    db = SessionLocal()
    try:
        node = db.query(ConceptNode).filter(ConceptNode.node_id == node_id).first()
        if not node:
            return
        if _has_question_for_node(node_id, db, diagnosis_purpose="concept_check"):
            return
        _generate_and_store_question(
            target_node=node,
            graph_context=graph_context,
            db=db,
            diagnosis_purpose="concept_check",
        )
    except Exception:
        pass
    finally:
        db.close()


def generate_followup_question_background(
    project_id: int,
    node_id: str,
    session_id: str,
) -> None:
    """백그라운드 태스크용 — 오답 시 선수 개념 followup 질문을 응답 반환 후 생성"""
    from app.db.session import SessionLocal
    db = SessionLocal()
    try:
        weak_node = db.query(ConceptNode).filter(ConceptNode.node_id == node_id).first()
        if weak_node:
            _ensure_prerequisite_followup_question_generated(
                project_id=project_id,
                weak_node=weak_node,
                session_id=session_id,
                db=db,
            )
    finally:
        db.close()


def mark_file_diagnosed(session_id: str, db: Session) -> None:
    """진단 완료 시 세션에서 답변된 문제의 노드가 속한 파일을 모두 DIAGNOSED로 마킹

    세션에 file_id가 없어도 실제 답변 노드 기반으로 파일을 추적함
    """
    answered_question_ids = [
        row.question_id
        for row in db.query(DiagnosisAnswer.question_id)
        .filter(DiagnosisAnswer.session_id == session_id)
        .all()
    ]
    if not answered_question_ids:
        return

    node_ids = [
        row.concept_id
        for row in db.query(DiagnosisQuestion.concept_id)
        .filter(DiagnosisQuestion.question_id.in_(answered_question_ids))
        .all()
    ]
    if not node_ids:
        return

    file_ids = {
        row.file_id
        for row in db.query(ConceptNode.file_id)
        .filter(ConceptNode.node_id.in_(node_ids), ConceptNode.file_id.isnot(None))
        .all()
    }
    if not file_ids:
        return

    db.query(File).filter(File.file_id.in_(file_ids)).update(
        {"diagnosis_status": "DIAGNOSED"}, synchronize_session=False
    )
    db.commit()


def get_diagnosis_status(session_id: str, db: Session) -> dict:
    """session_id 기준 진단 진행률 반환 — 실제 생성/답변/대기 question 수 기반"""
    answered = (
        db.query(DiagnosisAnswer)
        .filter(DiagnosisAnswer.session_id == session_id)
        .count()
    )

    session = db.query(DiagnosisSession).filter(DiagnosisSession.session_id == session_id).first()
    if session:
        total_generated = _get_total_session_question_count(session.project_id, session_id, db)
    else:
        total_generated = answered

    remaining = max(total_generated - answered, 0)
    is_complete = answered > 0 and remaining == 0
    progress = round(answered / TOTAL_QUESTIONS * 100, 1)

    return {
        "session_id": session_id,
        "answered": answered,
        "total_questions": TOTAL_QUESTIONS,
        "progress_percent": progress,
        "remaining_questions": remaining,
        "is_complete": is_complete,
        "has_next_question": remaining > 0,
    }


def _normalize_explanation(explanation: str | None) -> str | None:
    """구형 저장 포맷 'A. text: ### 헤딩' → '### 헤딩' 으로 정규화 (읽기 시점 보정)"""
    if not explanation:
        return explanation
    import re
    return re.sub(r'^[A-Za-z]\..+?:\s*(?=###)', '', explanation, flags=re.MULTILINE)


def _json_loads_list(value: str | None) -> list:
    if not value:
        return []

    parsed = json.loads(value)
    if isinstance(parsed, list):
        return parsed
    raise ValueError("Expected JSON list value.")


def _build_question_explanation(teacher_question: dict) -> str:
    blocks = []
    for choice in teacher_question.get("choices", []):
        if not isinstance(choice, dict):
            continue

        option_id = choice.get("option_id")
        text = choice.get("text")
        explanation = choice.get("explanation")
        if not (option_id and explanation):
            continue

        stripped = explanation.strip()
        if stripped.startswith("#"):
            blocks.append(stripped)
        else:
            prefix = f"{option_id}. {text}" if text else option_id
            blocks.append(f"### {prefix}\n\n{stripped}")

    if blocks:
        return "\n\n---\n\n".join(blocks)
    return str(teacher_question.get("llm_reason") or "").strip()


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


def _get_answered_count(session_id: str, db: Session) -> int:
    return (
        db.query(DiagnosisAnswer)
        .filter(DiagnosisAnswer.session_id == session_id)
        .count()
    )


def _build_graph_context(project_id: int, nodes: list[ConceptNode]) -> dict:
    return {
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


def _get_core_candidate_nodes(nodes: list[ConceptNode]) -> list[ConceptNode]:
    core_nodes = [node for node in _dedupe_nodes(nodes) if node.is_core]
    if not core_nodes:
        core_nodes = _dedupe_nodes(nodes)

    return sorted(
        core_nodes,
        key=lambda node: (
            -(1 if node.is_core else 0),
            -(node.core_score if node.core_score is not None else 0.0),
            node.diagnosis_count if node.diagnosis_count is not None else 0,
            node.understanding_score if node.understanding_score is not None else 0.5,
        ),
    )[:6]


def _ensure_core_questions_generated(
    *,
    project_id: int,
    core_nodes: list[ConceptNode],
    graph_context: dict,
    session_id: str | None,
    db: Session,
) -> None:
    last_error: Exception | None = None
    for target_node in core_nodes:
        if session_id and _get_total_session_question_count(project_id, session_id, db) >= TOTAL_QUESTIONS:
            break
        if _has_unanswered_question_for_node(target_node.node_id, db, diagnosis_purpose="concept_check"):
            continue

        try:
            _generate_and_store_question(
                target_node=target_node,
                graph_context=graph_context,
                db=db,
                diagnosis_purpose="concept_check",
            )
        except QuestionValidationError as error:
            last_error = error
            continue

    if last_error is not None and not _has_any_unanswered_question(core_nodes, session_id, db, "concept_check"):
        raise ValueError(f"질문 중복으로 핵심 개념 진단 문항을 생성할 수 없습니다: {last_error}")


def _ensure_followup_questions_for_session(
    project_id: int,
    session_id: str,
    nodes: list[ConceptNode],
    db: Session,
) -> None:
    """세션 내 오답 노드에 대해 followup 질문이 없으면 동기적으로 생성 — 백그라운드 미완료 대비 fallback"""
    if _get_total_session_question_count(project_id, session_id, db) >= TOTAL_QUESTIONS:
        return

    answered_question_ids = {
        answer.question_id
        for answer in db.query(DiagnosisAnswer.question_id)
        .filter(DiagnosisAnswer.session_id == session_id)
        .all()
    }
    if not answered_question_ids:
        return

    weak_answers = (
        db.query(DiagnosisAnswer)
        .filter(
            DiagnosisAnswer.session_id == session_id,
            DiagnosisAnswer.answer_score < LOW_SCORE_THRESHOLD,
            DiagnosisAnswer.is_skipped.is_(False),
        )
        .all()
    )

    node_map = {node.node_id: node for node in nodes}

    for answer in weak_answers:
        q = db.query(DiagnosisQuestion).filter(DiagnosisQuestion.question_id == answer.question_id).first()
        if not q:
            continue
        weak_node = node_map.get(q.concept_id)
        if not weak_node:
            continue
        _ensure_prerequisite_followup_question_generated(
            project_id=project_id,
            weak_node=weak_node,
            session_id=session_id,
            db=db,
        )
        if _get_total_session_question_count(project_id, session_id, db) >= TOTAL_QUESTIONS:
            return


def _ensure_prerequisite_followup_question_generated(
    *,
    project_id: int,
    weak_node: ConceptNode,
    session_id: str,
    db: Session,
) -> None:
    if not weak_node.is_core:
        return
    if _get_total_session_question_count(project_id, session_id, db) >= TOTAL_QUESTIONS:
        return

    prerequisite_candidates = _find_prerequisite_candidates(
        project_id=project_id,
        current_node_id=weak_node.node_id,
        db=db,
    )
    if not prerequisite_candidates:
        return

    nodes = db.query(ConceptNode).filter(ConceptNode.project_id == project_id).all()
    graph_context = _build_graph_context(project_id, nodes)
    for target_node in _build_candidate_nodes(nodes, prerequisite_candidates=prerequisite_candidates):
        if _has_session_question_for_node(
            target_node.node_id,
            session_id,
            db,
            diagnosis_purposes={"concept_check", "prerequisite_check", None},
        ):
            continue
        if _get_next_unanswered_question_for_nodes(
            nodes=[target_node],
            session_id=session_id,
            db=db,
            diagnosis_purpose="prerequisite_check",
        ):
            return
        if _get_total_session_question_count(project_id, session_id, db) >= TOTAL_QUESTIONS:
            return

        try:
            _generate_and_store_question(
                target_node=target_node,
                graph_context=graph_context,
                db=db,
                diagnosis_purpose="prerequisite_check",
            )
        except QuestionValidationError:
            continue
        return


def _generate_and_store_question(
    *,
    target_node: ConceptNode,
    graph_context: dict,
    db: Session,
    diagnosis_purpose: str,
) -> DiagnosisQuestion:
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

    teacher_question = generate_question(
        target_concept=target_concept,
        graph_context=graph_context,
        subject_id=subject_id,
        diagnosis_purpose=diagnosis_purpose,
        question_difficulty="medium",
        previous_reuse_keys=previous_reuse_keys,
    )

    return create_diagnosis_question(
        concept_id=target_node.node_id,
        difficulty=teacher_question["question_difficulty"],
        question_type=teacher_question["question_type"],
        question=teacher_question["question_text"],
        choices=teacher_question["choices"],
        correct_index=0,  # legacy non-null column — multi-select grading uses correct_option_ids
        db=db,
        correct_option_ids=teacher_question["correct_option_ids"],
        diagnostic_tags=teacher_question["diagnostic_tags"],
        tag_group=teacher_question["tag_group"],
        reuse_key=teacher_question["reuse_key"],
        diagnosis_purpose=teacher_question["diagnosis_purpose"],
        explanation=_build_question_explanation(teacher_question),
    )


def _question_to_response(question: DiagnosisQuestion, node: ConceptNode) -> dict:
    choices = _json_loads_list(question.choices)
    return {
        "question_id": question.question_id,
        "concept_id": question.concept_id,
        "concept_name": node.name,
        "difficulty": question.difficulty,
        "question_type": question.question_type,
        "diagnosis_purpose": question.diagnosis_purpose,
        "question": question.question,
        "choices": [
            {
                "id": choice["option_id"],
                "option_id": choice["option_id"],
                "text": choice["text"],
            }
            for choice in choices
        ],
    }


def _get_next_unanswered_question_for_nodes(
    *,
    nodes: list[ConceptNode],
    session_id: str | None,
    db: Session,
    diagnosis_purpose: str,
) -> tuple[DiagnosisQuestion, ConceptNode] | None:
    ordered_nodes = _dedupe_nodes(nodes)
    node_by_id = {node.node_id: node for node in ordered_nodes}
    node_order = {node.node_id: index for index, node in enumerate(ordered_nodes)}
    if not node_by_id:
        return None

    query = db.query(DiagnosisQuestion).filter(DiagnosisQuestion.concept_id.in_(node_by_id.keys()))
    if diagnosis_purpose == "concept_check":
        query = query.filter(
            (DiagnosisQuestion.diagnosis_purpose == diagnosis_purpose)
            | DiagnosisQuestion.diagnosis_purpose.is_(None)
        )
    else:
        query = query.filter(DiagnosisQuestion.diagnosis_purpose == diagnosis_purpose)

    questions = query.all()
    questions = sorted(
        questions,
        key=lambda question: (
            node_order.get(question.concept_id, len(node_order)),
            question.created_at,
        ),
    )

    # 어떤 세션에서도 이미 답변된 문제는 재사용하지 않음
    answered_anywhere = {
        row.question_id
        for row in db.query(DiagnosisAnswer.question_id)
        .filter(DiagnosisAnswer.question_id.in_([q.question_id for q in questions]))
        .all()
    }
    for question in questions:
        if question.question_id not in answered_anywhere:
            return question, node_by_id[question.concept_id]
    return None


def _has_any_unanswered_question(
    nodes: list[ConceptNode],
    session_id: str | None,
    db: Session,
    diagnosis_purpose: str,
) -> bool:
    return _get_next_unanswered_question_for_nodes(
        nodes=nodes,
        session_id=session_id,
        db=db,
        diagnosis_purpose=diagnosis_purpose,
    ) is not None


def _has_unanswered_question_for_node(node_id: str, db: Session, *, diagnosis_purpose: str) -> bool:
    """해당 노드에 아직 아무 세션에서도 답변되지 않은 문제가 있는지 확인"""
    questions = (
        db.query(DiagnosisQuestion.question_id)
        .filter(
            DiagnosisQuestion.concept_id == node_id,
            DiagnosisQuestion.diagnosis_purpose == diagnosis_purpose,
        )
        .all()
    )
    if not questions:
        return False
    question_ids = [q.question_id for q in questions]
    answered_ids = {
        row.question_id
        for row in db.query(DiagnosisAnswer.question_id)
        .filter(DiagnosisAnswer.question_id.in_(question_ids))
        .all()
    }
    return any(qid not in answered_ids for qid in question_ids)


def _has_question_for_node(node_id: str, db: Session, *, diagnosis_purpose: str) -> bool:
    return (
        db.query(DiagnosisQuestion)
        .filter(
            DiagnosisQuestion.concept_id == node_id,
            DiagnosisQuestion.diagnosis_purpose == diagnosis_purpose,
        )
        .first()
        is not None
    )


def _has_session_question_for_node(
    node_id: str,
    session_id: str,
    db: Session,
    *,
    diagnosis_purposes: set[str | None],
) -> bool:
    query = db.query(DiagnosisQuestion.question_id).filter(DiagnosisQuestion.concept_id == node_id)
    if None in diagnosis_purposes:
        non_null_purposes = [purpose for purpose in diagnosis_purposes if purpose is not None]
        query = query.filter(
            DiagnosisQuestion.diagnosis_purpose.in_(non_null_purposes)
            | DiagnosisQuestion.diagnosis_purpose.is_(None)
        )
    else:
        query = query.filter(DiagnosisQuestion.diagnosis_purpose.in_(diagnosis_purposes))

    question_ids = [question.question_id for question in query.all()]
    if not question_ids:
        return False

    return (
        db.query(DiagnosisAnswer)
        .filter(
            DiagnosisAnswer.session_id == session_id,
            DiagnosisAnswer.question_id.in_(question_ids),
        )
        .first()
        is not None
    )


def _is_question_answered_in_session(question_id: str, session_id: str, db: Session) -> bool:
    return (
        db.query(DiagnosisAnswer)
        .filter(
            DiagnosisAnswer.session_id == session_id,
            DiagnosisAnswer.question_id == question_id,
        )
        .first()
        is not None
    )


def _get_total_session_question_count(project_id: int, session_id: str, db: Session) -> int:
    diagnosed_file_ids = {
        row.file_id
        for row in db.query(File.file_id)
        .filter(File.project_id == project_id, File.diagnosis_status == "DIAGNOSED")
        .all()
        if row.file_id
    }
    node_ids = [
        node.node_id
        for node in db.query(ConceptNode)
        .filter(ConceptNode.project_id == project_id)
        .all()
        if node.node_source != "root" and node.file_id not in diagnosed_file_ids
    ]
    if not node_ids:
        return _get_answered_count(session_id, db)

    questions = (
        db.query(DiagnosisQuestion)
        .filter(
            DiagnosisQuestion.concept_id.in_(node_ids),
            (
                DiagnosisQuestion.diagnosis_purpose.in_(["concept_check", "prerequisite_check"])
                | DiagnosisQuestion.diagnosis_purpose.is_(None)
            ),
        )
        .all()
    )
    answered_question_ids = {
        answer.question_id
        for answer in db.query(DiagnosisAnswer.question_id)
        .filter(DiagnosisAnswer.session_id == session_id)
        .all()
    }
    pending_count = sum(1 for question in questions if question.question_id not in answered_question_ids)
    return len(answered_question_ids) + pending_count


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
            "explanation": _normalize_explanation(q.explanation),
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
            "explanation": _normalize_explanation(q.explanation),
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
            "explanation": _normalize_explanation(q.explanation),
        })
    return result
