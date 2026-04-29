# 지식 그래프 라우터 — 노드/엣지 조회

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.services import graph_service
from app.schemas.graph import NodeResponse, EdgeResponse

router = APIRouter()


@router.get("/me")
def get_my_graph(user_id: str, subject: str | None = None, db: Session = Depends(get_db)):
    """사용자의 전체 프로젝트 지식 그래프 반환 (subject 파라미터로 과목 필터 가능)"""
    # TODO: 백엔드1과 JWT 시크릿 키 공유 후 헤더에서 user_id 파싱하도록 변경 (구글 로그인 연동)
    return {"success": True, "data": None, "message": "미구현"}


@router.get("/{project_id}")
def get_project_graph(project_id: str, db: Session = Depends(get_db)):
    """특정 프로젝트의 노드 + 엣지 전체 반환 (그래프 시각화용)"""
    graph = graph_service.get_graph_by_project(project_id, db)
    data = {
        "nodes": [NodeResponse.from_orm(n) for n in graph["nodes"]],
        "edges": [EdgeResponse.from_orm(e) for e in graph["edges"]],
    }
    return {"success": True, "data": data, "message": ""}


@router.get("/{project_id}/recent")
def get_recent_nodes(project_id: str, db: Session = Depends(get_db)):
    """최근 갱신된 노드 목록 반환 (채팅 화면 우측 패널용)"""
    nodes = graph_service.get_recent_nodes(project_id, db)
    return {"success": True, "data": [NodeResponse.from_orm(n) for n in nodes], "message": ""}


@router.get("/nodes/{node_id}")
def get_node_detail(node_id: str, db: Session = Depends(get_db)):
    """노드 상세 정보 반환 — 개념 설명, 이해도 상태 포함"""
    node = graph_service.get_node_by_id(node_id, db)
    if not node:
        raise HTTPException(status_code=404, detail="노드를 찾을 수 없습니다.")
    return {"success": True, "data": NodeResponse.from_orm(node), "message": ""}

