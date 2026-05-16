import json
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.deferred_mini_quiz import DeferredMiniQuiz
from app.models.diagnosis import DiagnosisAnswer, DiagnosisQuestion
from app.models.graph import ConceptNode
from app.ai.diagnosis_ai import (
    evaluate_answer,
    generate_question,
    score_to_level,
)
from app.services.diagnosis_service import apply_evaluation_to_nodes, create_diagnosis_question
from app.services.concept_quiz_counter_service import reset_concept_quiz_counter


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


def defer_mini_quiz_question(project_id: int, node_id: str, db: Session) -> dict:
    """나중에 풀기 — 문제 생성 후 deferred_mini_quizzes에 저장, 카운터 초기화"""
    result = generate_mini_quiz_question(project_id, node_id, db)

    deferred = DeferredMiniQuiz(
        project_id=project_id,
        node_id=node_id,
        question_id=result["question_id"],
        status="PENDING",
    )
    db.add(deferred)

    reset_concept_quiz_counter(db, project_id, node_id)

    db.commit()
    db.refresh(deferred)

    return {**result, "deferred_id": deferred.id}


def get_deferred_mini_quizzes(project_id: int, db: Session) -> list[dict]:
    """프로젝트의 미뤄둔 퀴즈 목록 반환 (PENDING 상태만)"""
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

    result = []
    for deferred, question, node in rows:
        choices = json.loads(question.choices) if question.choices else []
        result.append({
            "deferred_id": deferred.id,
            "question_id": question.question_id,
            "node_id": node.node_id,
            "node_name": node.name,
            "question": question.question,
            "choices": [{"option_id": c["option_id"], "text": c["text"]} for c in choices],
            "deferred_at": deferred.created_at,
        })

    return result


def submit_mini_quiz_answer(
    project_id: int,
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

    # 미뤄둔 퀴즈였으면 완료 처리
    deferred = db.query(DeferredMiniQuiz).filter(
        DeferredMiniQuiz.question_id == question_id,
        DeferredMiniQuiz.status == "PENDING",
    ).first()
    if deferred:
        deferred.status = "COMPLETED"
        deferred.completed_at = datetime.now(timezone.utc)

    db.commit()

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
    }
