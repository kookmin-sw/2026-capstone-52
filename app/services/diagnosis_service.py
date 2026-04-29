# 진단 서비스 — 진단 세션 생성, 답변 저장 및 진행 상태 계산

import json
from sqlalchemy.orm import Session
from app.models.graph import ConceptNode
from app.models.diagnosis import DiagnosisSession


def create_diagnosis_session(
    project_id: str, node_id: str, question: str, choices: list[str], correct_index: int, db: Session
) -> DiagnosisSession:
    session = DiagnosisSession(
        project_id=project_id,
        user_id="system",  # TODO: JWT에서 user_id 추출 후 교체
        node_id=node_id,
        question=question,
        choices=json.dumps(choices, ensure_ascii=False),
        correct_index=correct_index,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def submit_answer(diagnosis_id: str, selected_index: int, db: Session) -> dict | None:
    """사용자 선택 인덱스 저장 후 정답 여부 반환"""
    session = db.query(DiagnosisSession).filter(DiagnosisSession.diagnosis_id == diagnosis_id).first()
    if not session:
        return None
    session.selected_index = selected_index
    db.commit()
    db.refresh(session)

    is_correct = selected_index == session.correct_index
    node_status = "KNOWN" if is_correct else "NEEDS_REVIEW"
    return {"session": session, "is_correct": is_correct, "node_status": node_status}


def get_diagnosis_status(project_id: str, db: Session) -> dict:
    """진단 진행률 계산 — UNKNOWN이 아닌 노드를 진단 완료로 간주"""
    total = db.query(ConceptNode).filter(ConceptNode.project_id == project_id).count()
    diagnosed = (
        db.query(ConceptNode)
        .filter(ConceptNode.project_id == project_id, ConceptNode.status != "UNKNOWN")
        .count()
    )
    progress = round((diagnosed / total * 100) if total > 0 else 0, 1)
    return {"total_nodes": total, "diagnosed_nodes": diagnosed, "progress_percent": progress}
