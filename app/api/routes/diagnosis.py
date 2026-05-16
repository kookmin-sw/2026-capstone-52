# 수준 진단 라우터 — 세션 생성, 질문 생성, 답변 처리, 진행 상태 조회

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.security import get_optional_current_user
from app.db.session import get_db
from app.services import diagnosis_service
from app.services.diagnosis_report_service import create_diagnosis_report_chats
from app.schemas.diagnosis import (
    DiagnosisSessionCreateResponse,
    DiagnosisQuestionResponse,
    DiagnosisAnswerRequest,
    DiagnosisReportRequest,
    DiagnosisAnswerResponse,
    DiagnosisStatusResponse,
    DiagnosisNodeItem,
)
from app.ai.diagnosis_ai import DiagnosisAIError
from app.models.project import Project
from app.models.user import User

router = APIRouter()


@router.post("/{project_id}/sessions", response_model=None)
def create_diagnosis_session(project_id: int):
    """새 진단 세션 ID 발급 — PDF 업로드 후 수준 진단 시작 시 호출

    반환된 session_id를 이후 질문/답변 요청에 모두 첨부해야 함
    """
    session_id = diagnosis_service.create_session_id()
    return {
        "success": True,
        "data": DiagnosisSessionCreateResponse(session_id=session_id),
        "message": "",
    }


@router.post("/{project_id}/questions", response_model=None)
def generate_diagnosis_question(project_id: int, session_id: str | None = None, db: Session = Depends(get_db)):
    """현재 그래프 상태 기반으로 다음 진단 질문 생성"""
    try:
        result = diagnosis_service.generate_next_question(project_id, db, session_id=session_id)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except DiagnosisAIError as error:
        raise HTTPException(status_code=500, detail=str(error)) from error

    if result is None:
        raise HTTPException(status_code=404, detail="진단 가능한 개념이 없습니다.")

    return {
        "success": True,
        "data": DiagnosisQuestionResponse(**result),
        "message": "",
    }


@router.post("/{project_id}/answers", response_model=None)
def submit_answer(project_id: int, body: DiagnosisAnswerRequest, db: Session = Depends(get_db)):
    """사용자 답변 저장 → AI score 계산 → affects 노드 전체 상태 갱신"""
    try:
        result = diagnosis_service.submit_answer(
            question_id=body.question_id,
            session_id=body.session_id,
            selected_index=body.selected_index,
            selected_option_ids=body.selected_option_ids,
            is_skipped=body.is_skipped,
            db=db,
        )
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    if not result:
        raise HTTPException(status_code=404, detail="질문을 찾을 수 없습니다.")

    return {
        "success": True,
        "data": DiagnosisAnswerResponse(
            is_correct=result["is_correct"],
            correct_index=result["correct_index"],
            is_fully_correct=result.get("is_fully_correct"),
            partial_score=result.get("partial_score"),
            answer_score=result.get("answer_score"),
            answer_level=result.get("answer_level"),
            correct_option_ids=result.get("correct_option_ids"),
            selected_option_ids=result.get("selected_option_ids"),
            missed_correct_option_ids=result.get("missed_correct_option_ids"),
            wrong_selected_option_ids=result.get("wrong_selected_option_ids"),
            invalid_selected_option_ids=result.get("invalid_selected_option_ids"),
            updated_nodes=result["updated_nodes"],
        ),
        "message": "",
    }


@router.post("/{project_id}/report", response_model=None)
def create_diagnosis_report(
    project_id: int,
    body: DiagnosisReportRequest,
    current_user: User | None = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    """수준진단 결과를 채팅 리포트 메시지 2개로 생성"""
    project = db.query(Project).filter(Project.project_id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다.")

    if current_user and project.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="프로젝트 접근 권한이 없습니다.")

    user_id = current_user.user_id if current_user else body.user_id or project.user_id

    try:
        chats = create_diagnosis_report_chats(
            db=db,
            project_id=project_id,
            session_id=body.session_id,
            user_id=user_id,
        )
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    return {
        "success": True,
        "data": {
            "messages": [
                {
                    "chat_id": chat.chat_id,
                    "project_id": chat.project_id,
                    "user_message": chat.user_message,
                    "ai_response": chat.ai_response,
                    "response_type": chat.response_type,
                    "created_at": chat.created_at,
                }
                for chat in chats
            ]
        },
        "message": "수준진단 리포트 생성 성공",
    }


@router.get("/{project_id}/status", response_model=None)
def get_diagnosis_status(project_id: int, session_id: str, db: Session = Depends(get_db)):
    """진단 진행률 반환 — session_id 쿼리 파라미터로 PDF 업로드 차수 구분

    예: GET /api/diagnosis/{project_id}/status?session_id=uuid-...
    """
    status = diagnosis_service.get_diagnosis_status(project_id, session_id, db)
    return {"success": True, "data": status, "message": ""}


@router.get("/{project_id}/nodes", response_model=None)
def get_diagnosis_nodes(project_id: int, question_id: str | None = None, db: Session = Depends(get_db)):
    """진단 개념 목록 반환 — 우측 패널용

    question_id 전달 시 해당 문제의 concept_id 노드를 '진행 중'으로 표시
    예: GET /api/diagnosis/{project_id}/nodes?question_id=uuid-...
    """
    nodes = diagnosis_service.get_diagnosis_node_list(project_id, question_id, db)
    return {
        "success": True,
        "data": [DiagnosisNodeItem(**n) for n in nodes],
        "message": "",
    }
