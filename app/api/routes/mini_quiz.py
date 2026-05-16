# 미니 퀴즈 라우터 — 채팅 중 개념 카운트 조건 충족 시 팝업 퀴즈 생성/제출

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.project import Project
from app.models.user import User
from app.schemas.mini_quiz import MiniQuizAnswerRequest, MiniQuizAnswerResponse, DeferredMiniQuizItem
from app.schemas.diagnosis import DiagnosisQuestionResponse
from app.schemas.quiz_review import QuizQuestionReview
from app.services import mini_quiz_service
from app.services.diagnosis_service import get_questions_review
from app.ai.diagnosis_ai import DiagnosisAIError, QuestionValidationError

router = APIRouter()


def _get_project_or_403(project_id: int, current_user: User, db: Session) -> Project:
    project = db.query(Project).filter(Project.project_id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다.")
    if project.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="프로젝트 접근 권한이 없습니다.")
    return project


@router.post("/{project_id}/generate", response_model=None)
def generate_mini_quiz(
    project_id: int,
    node_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """개념 카운트 조건 충족 시 해당 노드에 대한 미니 퀴즈 문제 생성"""
    _get_project_or_403(project_id, current_user, db)

    try:
        result = mini_quiz_service.generate_mini_quiz_question(project_id, node_id, db)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except QuestionValidationError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except DiagnosisAIError as error:
        raise HTTPException(status_code=500, detail=str(error)) from error

    return {"success": True, "data": DiagnosisQuestionResponse(**result), "message": ""}


@router.post("/{project_id}/submit", response_model=None)
def submit_mini_quiz(
    project_id: int,
    body: MiniQuizAnswerRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """미니 퀴즈 답변 제출 — 노드 score 갱신 및 개념 카운트 초기화"""
    _get_project_or_403(project_id, current_user, db)

    try:
        result = mini_quiz_service.submit_mini_quiz_answer(
            project_id=project_id,
            user_id=current_user.user_id,
            question_id=body.question_id,
            selected_option_ids=body.selected_option_ids,
            is_skipped=body.is_skipped,
            db=db,
        )
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error

    if not result:
        raise HTTPException(status_code=404, detail="질문을 찾을 수 없습니다.")

    return {"success": True, "data": MiniQuizAnswerResponse(**result), "message": "미니 퀴즈 완료"}


@router.get("/{project_id}/review", response_model=None)
def get_mini_quiz_review(
    project_id: int,
    question_ids: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """미니 퀴즈 리뷰 — 쉼표로 구분된 question_ids로 정답/사용자 답/해설 반환

    예: GET /api/mini-quiz/{project_id}/review?question_ids=uuid1,uuid2
    """
    _get_project_or_403(project_id, current_user, db)

    ids = [qid.strip() for qid in question_ids.split(",") if qid.strip()]
    reviews = get_questions_review(ids, db)
    return {
        "success": True,
        "data": [QuizQuestionReview(**r) for r in reviews],
        "message": "",
    }


@router.post("/{project_id}/defer", response_model=None)
def defer_mini_quiz(
    project_id: int,
    node_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """나중에 풀기 — 문제를 미리 생성해 저장하고 카운터 초기화"""
    _get_project_or_403(project_id, current_user, db)

    try:
        result = mini_quiz_service.defer_mini_quiz_question(project_id, node_id, db)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except QuestionValidationError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except DiagnosisAIError as error:
        raise HTTPException(status_code=500, detail=str(error)) from error

    return {"success": True, "data": DiagnosisQuestionResponse(**result), "message": ""}


@router.get("/{project_id}/deferred", response_model=None)
def get_deferred_mini_quizzes(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """미뤄둔 퀴즈 목록 조회 (대시보드 팝업용)"""
    _get_project_or_403(project_id, current_user, db)

    items = mini_quiz_service.get_deferred_mini_quizzes(project_id, db)
    return {
        "success": True,
        "data": [DeferredMiniQuizItem(**item) for item in items],
        "message": "",
    }
