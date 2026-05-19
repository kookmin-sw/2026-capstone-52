# 지식 그래프 라우터 — 노드/엣지 조회

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.security import get_current_user
from app.db.session import get_db
from app.models.project import Project
from app.models.user import User
from app.services import graph_service
from app.services.diagnosis_service import get_node_quiz_history
from app.schemas.graph import NodeResponse, EdgeResponse, NodeDetailResponse, RelatedChatResponse
from app.schemas.quiz_review import QuizQuestionReview

router = APIRouter()


def _get_project_or_403(project_id: int, current_user: User, db: Session) -> Project:
    project = db.query(Project).filter(Project.project_id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다.")
    if project.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="프로젝트 접근 권한이 없습니다.")
    return project


@router.get("/me")
def get_my_graph(
    project_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """사용자의 전체 프로젝트 지식 그래프 반환 (project_id 파라미터로 특정 프로젝트 필터 가능)"""
    return {"success": True, "data": None, "message": "미구현"}


@router.get("/nodes/{node_id}")
def get_node_detail(
    node_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """노드 상세 정보 반환 — 개념 설명, 관련 개념, 관련 학습 기록 포함"""
    node = graph_service.get_node_by_id(node_id, db)
    if not node:
        raise HTTPException(status_code=404, detail="노드를 찾을 수 없습니다.")

    _get_project_or_403(node.project_id, current_user, db)

    related_nodes = graph_service.get_related_nodes(node_id, db)
    related_chats = graph_service.get_related_chats(node, db)
    alias_cache = graph_service.build_alias_cache([node])

    data = NodeDetailResponse(
        **NodeResponse(**graph_service.build_node_response_data(node, alias_cache)).model_dump(),
        related_nodes=related_nodes,
        related_chats=[RelatedChatResponse(**c) for c in related_chats],
    )
    return {"success": True, "data": data, "message": ""}


@router.get("/nodes/{node_id}/quiz-history")
def get_node_quiz_history_view(
    node_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """노드 클릭 시 해당 개념의 수준진단/미니퀴즈 이력 반환"""
    node = graph_service.get_node_by_id(node_id, db)
    if not node:
        raise HTTPException(status_code=404, detail="노드를 찾을 수 없습니다.")

    _get_project_or_403(node.project_id, current_user, db)

    history = get_node_quiz_history(node_id, db)
    return {"success": True, "data": [QuizQuestionReview(**h) for h in history], "message": ""}


@router.get("/{project_id}")
def get_project_graph(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """특정 프로젝트의 노드 + 엣지 전체 반환 (그래프 시각화용)"""
    _get_project_or_403(project_id, current_user, db)

    graph = graph_service.get_graph_by_project(project_id, db)
    alias_cache = graph_service.build_alias_cache(graph["nodes"])
    data = {
        "nodes": [NodeResponse(**graph_service.build_node_response_data(n, alias_cache)) for n in graph["nodes"]],
        "edges": [EdgeResponse.model_validate(e) for e in graph["edges"]],
    }
    return {"success": True, "data": data, "message": ""}


@router.get("/{project_id}/recent")
def get_recent_nodes(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """최근 갱신된 노드 목록 반환 (채팅 화면 우측 패널용)"""
    _get_project_or_403(project_id, current_user, db)

    nodes = graph_service.get_recent_nodes(project_id, db)
    alias_cache = graph_service.build_alias_cache(nodes)
    return {
        "success": True,
        "data": [NodeResponse(**graph_service.build_node_response_data(n, alias_cache)) for n in nodes],
        "message": "",
    }
