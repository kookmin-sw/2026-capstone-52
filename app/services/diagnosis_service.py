# 수준 진단 서비스 — 질문 생성, 답변 저장, score 노드 반영
#
# score 계산 및 status 변환은 AI 레이어(diagnosis_ai.calculate_score)에서 담당
# 서비스는 AI 결과를 받아 concept_nodes에 저장하는 역할만 함

import json
import uuid
from sqlalchemy.orm import Session
from app.models.graph import ConceptNode
from app.models.diagnosis import DiagnosisQuestion, DiagnosisAnswer
from app.ai.diagnosis_ai import calculate_score


# ── 세션 ──────────────────────────────────────────────────────────────────────

def create_session_id() -> str:
    """새 진단 세션 ID 발급 — PDF 업로드 시마다 호출해서 1차/2차 진단을 구분"""
    return str(uuid.uuid4())


# ── 질문 ──────────────────────────────────────────────────────────────────────

def create_diagnosis_question(
    concept_id: str,
    difficulty: str,
    question_type: str,
    affects: list[str],
    question: str,
    choices: list[str],
    correct_index: int,
    db: Session,
) -> DiagnosisQuestion:
    """AI 모듈 결과로 진단 질문 생성 및 저장"""
    q = DiagnosisQuestion(
        concept_id=concept_id,
        difficulty=difficulty,
        question_type=question_type,
        affects=json.dumps(affects),
        question=question,
        choices=json.dumps(choices, ensure_ascii=False),
        correct_index=correct_index,
    )
    db.add(q)
    db.commit()
    db.refresh(q)
    return q


# ── 답변 처리 ─────────────────────────────────────────────────────────────────

def submit_answer(
    question_id: str,
    session_id: str,
    selected_index: int,
    is_skipped: bool,
    db: Session,
) -> dict | None:
    """답변 저장 → AI에 score 요청 → affects 노드 전체에 반영

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

    is_correct = (not is_skipped) and (selected_index == q.correct_index)

    # 답변 저장 — score는 여기에 없고 아래에서 AI 호출 후 concept_nodes에 반영
    answer = DiagnosisAnswer(
        question_id=question_id,
        session_id=session_id,
        is_correct=is_correct,
        is_skipped=is_skipped,
    )
    db.add(answer)
    db.flush()

    affects: list[str] = json.loads(q.affects) if q.affects else []
    # concept_id가 affects에 없으면 포함 (주 측정 개념은 항상 업데이트)
    if q.concept_id not in affects:
        affects = [q.concept_id] + affects

    updated_nodes = _apply_score_to_nodes(
        node_ids=affects,
        concept_id=q.concept_id,
        difficulty=q.difficulty,
        question_type=q.question_type,
        is_correct=is_correct,
        is_skipped=is_skipped,
        db=db,
    )

    db.commit()
    return {
        "is_correct": is_correct,
        "correct_index": q.correct_index,
        "updated_nodes": updated_nodes,
    }


def _apply_score_to_nodes(
    node_ids: list[str],
    concept_id: str,
    difficulty: str,
    question_type: str,
    is_correct: bool,
    is_skipped: bool,
    db: Session,
) -> list[dict]:
    """affects 노드 목록 전체에 AI가 결정한 score/status 적용 — 서비스는 저장만 담당"""
    results = []

    for node_id in node_ids:
        node = db.query(ConceptNode).filter(ConceptNode.node_id == node_id).first()
        if not node:
            continue

        current_score = node.understanding_score if node.understanding_score is not None else 0.5

        ai_result = calculate_score(
            node_id=node_id,
            node_name=node.name,
            current_score=current_score,
            difficulty=difficulty,
            question_type=question_type,
            is_correct=is_correct,
            is_skipped=is_skipped,
            is_primary=(node_id == concept_id),
        )

        node.understanding_score = ai_result["score"]
        node.status = ai_result["status"]

        results.append({
            "node_id": node.node_id,
            "status": node.status,
            "understanding_score": node.understanding_score,
        })

    return results


# ── 진행 상태 ─────────────────────────────────────────────────────────────────

TOTAL_QUESTIONS = 12
NODE_STATUS_UNSEEN = "UNSEEN"
NODE_STATUS_MASTERED = "MASTERED"


def get_diagnosis_node_list(project_id: str, question_id: str | None, db: Session) -> list[dict]:
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


def get_diagnosis_status(project_id: str, session_id: str, db: Session) -> dict:
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
