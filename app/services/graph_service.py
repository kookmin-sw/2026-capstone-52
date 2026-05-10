# 그래프 서비스 — 개념 노드/엣지 조회 및 저장

from sqlalchemy.orm import Session
from app.models.graph import ConceptNode, ConceptEdge
from app.models.chat import Chat


def get_graph_by_project(project_id: str, db: Session):
    """프로젝트의 전체 노드와 엣지 반환"""
    nodes = db.query(ConceptNode).filter(ConceptNode.project_id == project_id).all()
    edges = db.query(ConceptEdge).filter(ConceptEdge.project_id == project_id).all()
    return {"nodes": nodes, "edges": edges}


def get_recent_nodes(project_id: str, db: Session, limit: int = 10):
    """최근 갱신된 노드 반환 (updated_at 기준 내림차순)"""
    return (
        db.query(ConceptNode)
        .filter(ConceptNode.project_id == project_id)
        .order_by(ConceptNode.updated_at.desc())
        .limit(limit)
        .all()
    )


def get_node_by_id(node_id: str, db: Session) -> ConceptNode | None:
    """node_id로 노드 단건 조회"""
    return db.query(ConceptNode).filter(ConceptNode.node_id == node_id).first()


def update_node_score(node_id: str, understanding_score: float, status: str, db: Session) -> ConceptNode | None:
    """노드 score와 status 동시 업데이트 — score는 서비스 레이어에서 계산된 값을 받음"""
    node = db.query(ConceptNode).filter(ConceptNode.node_id == node_id).first()
    if node:
        node.understanding_score = understanding_score
        node.status = status
        db.commit()
        db.refresh(node)
    return node


def get_related_nodes(node_id: str, db: Session) -> list[str]:
    """해당 노드와 엣지로 연결된 인접 노드 이름 목록 반환"""
    edges = db.query(ConceptEdge).filter(
        (ConceptEdge.source_node_id == node_id) | (ConceptEdge.target_node_id == node_id)
    ).all()

    related_ids = set()
    for edge in edges:
        if edge.source_node_id == node_id:
            related_ids.add(edge.target_node_id)
        else:
            related_ids.add(edge.source_node_id)

    nodes = db.query(ConceptNode).filter(ConceptNode.node_id.in_(related_ids)).all()
    return [n.name for n in nodes]


def get_related_chats(node: ConceptNode, db: Session) -> list[dict]:
    """노드 이름이 포함된 채팅 기록 반환 (user_message 텍스트 검색)"""
    chats = (
        db.query(Chat)
        .filter(
            Chat.project_id == node.project_id,
            Chat.user_message.ilike(f"%{node.name}%"),
        )
        .order_by(Chat.created_at.asc())
        .all()
    )
    return [
        {
            "chat_id": c.chat_id,
            "date": c.created_at.strftime("%Y.%m.%d"),
            "message": c.user_message,
        }
        for c in chats
    ]


def save_graph_from_ai(project_id: str, file_id: str, ai_result: dict, db: Session):
    """AI 모듈 결과를 받아 concept_nodes와 concept_edges에 저장

    ai_result 형식:
    {
      "concepts": [{"name": str, "description": str, "group": str}],
      "relations": [{"source": str, "target": str, "relation_type": str}]
    }
    """
    # 노드 먼저 저장하면서 이름→노드 객체 매핑 생성 (엣지 연결 시 사용)
    name_to_node: dict[str, ConceptNode] = {}
    for concept in ai_result.get("concepts", []):
        node = ConceptNode(
            project_id=project_id,
            file_id=file_id,
            name=concept["name"],
            description=concept.get("description"),
            group=concept.get("group"),
        )
        db.add(node)
        db.flush()  # node_id 생성을 위해 flush (commit은 마지막에 한 번만)
        name_to_node[concept["name"]] = node

    # 엣지 저장 — source/target 노드가 모두 존재할 때만 저장
    for relation in ai_result.get("relations", []):
        source = name_to_node.get(relation["source"])
        target = name_to_node.get(relation["target"])
        if source and target:
            edge = ConceptEdge(
                project_id=project_id,
                source_node_id=source.node_id,
                target_node_id=target.node_id,
                relation_type=relation["relation_type"],
            )
            db.add(edge)

    db.commit()
