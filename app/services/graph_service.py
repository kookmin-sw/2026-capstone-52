from sqlalchemy.orm import Session
from app.models.graph import ConceptNode, ConceptEdge


def get_graph_by_project(project_id: str, db: Session):
    nodes = db.query(ConceptNode).filter(ConceptNode.project_id == project_id).all()
    edges = db.query(ConceptEdge).filter(ConceptEdge.project_id == project_id).all()
    return {"nodes": nodes, "edges": edges}


def get_recent_nodes(project_id: str, db: Session, limit: int = 10):
    return (
        db.query(ConceptNode)
        .filter(ConceptNode.project_id == project_id)
        .order_by(ConceptNode.updated_at.desc())
        .limit(limit)
        .all()
    )


def get_node_by_id(node_id: str, db: Session) -> ConceptNode | None:
    return db.query(ConceptNode).filter(ConceptNode.node_id == node_id).first()


def update_node_status(node_id: str, status: str | None, score: float | None, db: Session) -> ConceptNode | None:
    node = db.query(ConceptNode).filter(ConceptNode.node_id == node_id).first()
    if node:
        if status is not None:
            node.status = status
        if score is not None:
            node.score = score
        db.commit()
        db.refresh(node)
    return node


def save_graph_from_ai(project_id: str, file_id: str, ai_result: dict, db: Session):
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
        db.flush()
        name_to_node[concept["name"]] = node

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
