from sqlalchemy.orm import Session
from app.models.graph import ConceptNode
from app.models.diagnosis import DiagnosisSession


def get_diagnosis_status(project_id: str, db: Session) -> dict:
    total = db.query(ConceptNode).filter(ConceptNode.project_id == project_id).count()
    diagnosed = (
        db.query(ConceptNode)
        .filter(ConceptNode.project_id == project_id, ConceptNode.status != "UNKNOWN")
        .count()
    )
    progress = round((diagnosed / total * 100) if total > 0 else 0, 1)
    return {"total_nodes": total, "diagnosed_nodes": diagnosed, "progress_percent": progress}


def save_diagnosis_answer(diagnosis_id: str, answer: str, db: Session) -> DiagnosisSession | None:
    session = db.query(DiagnosisSession).filter(DiagnosisSession.diagnosis_id == diagnosis_id).first()
    if session:
        session.answer = answer
        db.commit()
        db.refresh(session)
    return session
