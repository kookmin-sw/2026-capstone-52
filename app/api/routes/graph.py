from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.services import graph_service
from app.schemas.graph import NodeUpdate

router = APIRouter()


@router.get("/{project_id}")
def get_project_graph(project_id: str, db: Session = Depends(get_db)):
    graph = graph_service.get_graph_by_project(project_id, db)
    return {"success": True, "data": graph, "message": ""}


@router.get("/me")
def get_my_graph(user_id: str, subject: str | None = None, db: Session = Depends(get_db)):
    # TODO: user_id를 JWT에서 추출하도록 변경 필요
    return {"success": True, "data": None, "message": "미구현"}


@router.get("/{project_id}/recent")
def get_recent_nodes(project_id: str, db: Session = Depends(get_db)):
    nodes = graph_service.get_recent_nodes(project_id, db)
    return {"success": True, "data": nodes, "message": ""}


@router.get("/nodes/{node_id}")
def get_node_detail(node_id: str, db: Session = Depends(get_db)):
    node = graph_service.get_node_by_id(node_id, db)
    if not node:
        raise HTTPException(status_code=404, detail="노드를 찾을 수 없습니다.")
    return {"success": True, "data": node, "message": ""}


@router.patch("/nodes/{node_id}")
def update_node(node_id: str, body: NodeUpdate, db: Session = Depends(get_db)):
    node = graph_service.update_node_status(node_id, body.status, body.score, db)
    if not node:
        raise HTTPException(status_code=404, detail="노드를 찾을 수 없습니다.")
    return {"success": True, "data": node, "message": "노드 업데이트 완료"}
