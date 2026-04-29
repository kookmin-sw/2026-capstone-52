# 수준 진단 라우터 — 진단 질문 생성, 답변 처리, 진행 상태 조회

import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.services import diagnosis_service, graph_service
from app.schemas.diagnosis import DiagnosisAnswerRequest, DiagnosisQuestionResponse, DiagnosisAnswerResponse
from app.models.graph import ConceptNode
from app.ai.diagnosis_ai import generate_question

router = APIRouter()


@router.post("/{project_id}/questions", response_model=None)
def generate_diagnosis_question(project_id: str, db: Session = Depends(get_db)):
    """현재 그래프 상태 기반으로 객관식 진단 질문 생성"""
    nodes = db.query(ConceptNode).filter(ConceptNode.project_id == project_id).all()
    node_list = [{"node_id": n.node_id, "name": n.name, "status": n.status} for n in nodes]

    ai_result = generate_question(node_list)
    session = diagnosis_service.create_diagnosis_session(
        project_id,
        ai_result["node_id"],
        ai_result["question"],
        ai_result["choices"],
        ai_result["correct_index"],
        db,
    )
    return {
        "success": True,
        "data": DiagnosisQuestionResponse(
            diagnosis_id=session.diagnosis_id,
            node_id=session.node_id,
            question=session.question,
            choices=json.loads(session.choices),
        ),
        "message": "",
    }


@router.post("/{project_id}/answers", response_model=None)
def submit_answer(project_id: str, body: DiagnosisAnswerRequest, db: Session = Depends(get_db)):
    """사용자 선택 저장 및 정답 여부 반환, 노드 상태 갱신"""
    result = diagnosis_service.submit_answer(body.diagnosis_id, body.selected_index, db)
    if not result:
        raise HTTPException(status_code=404, detail="진단 세션을 찾을 수 없습니다.")

    session = result["session"]
    if session.node_id:
        graph_service.update_node_status(session.node_id, result["node_status"], db)

    return {
        "success": True,
        "data": DiagnosisAnswerResponse(
            is_correct=result["is_correct"],
            correct_index=session.correct_index,
            node_status=result["node_status"],
        ),
        "message": "",
    }


@router.get("/{project_id}/status")
def get_diagnosis_status(project_id: str, db: Session = Depends(get_db)):
    """진단 진행률 반환 — 전체 노드 수, 진단 완료 노드 수, 진행 퍼센트"""
    status = diagnosis_service.get_diagnosis_status(project_id, db)
    return {"success": True, "data": status, "message": ""}
