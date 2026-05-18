# 그래프 서비스 — 개념 노드/엣지 조회 및 저장

from sqlalchemy.orm import Session
from app.models.graph import ConceptNode, ConceptEdge, NODE_STATUS_UNSEEN
from app.models.chat import Chat


def get_graph_by_project(project_id: int, db: Session):
    """프로젝트의 전체 노드와 엣지 반환"""
    nodes = db.query(ConceptNode).filter(ConceptNode.project_id == project_id).all()
    edges = db.query(ConceptEdge).filter(ConceptEdge.project_id == project_id).all()
    return {"nodes": nodes, "edges": edges}


def get_recent_nodes(project_id: int, db: Session, limit: int = 10):
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


def save_graph_from_ai(project_id: int, file_id: str, ai_result: dict, db: Session):
    """AI 모듈 결과를 받아 concept_nodes와 concept_edges에 upsert

    같은 (project_id, concept_id) 노드가 이미 있으면 update(merge),
    없으면 insert. 엣지도 (project_id, source, target, relation_type) 기준으로
    중복 insert를 방지합니다.
    """
    subject_id = ai_result.get("subject_id")

    # 기존 노드 미리 로드 — concept_id 기반 O(1) 조회
    existing_nodes: dict[str, ConceptNode] = {
        node.concept_id: node
        for node in db.query(ConceptNode).filter(ConceptNode.project_id == project_id).all()
        if node.concept_id
    }

    concept_id_to_node: dict[str, ConceptNode] = {}
    name_to_node: dict[str, ConceptNode] = {}

    for concept in ai_result.get("concepts", []):
        node_name = _get_concept_name(concept)
        if not node_name:
            continue

        cid = concept.get("concept_id")
        if cid and cid in existing_nodes:
            # 기존 노드 merge — is_core가 올라가거나 description이 보강되는 경우만 덮어씀
            node = existing_nodes[cid]
            node.name = node_name
            if concept.get("description"):
                node.description = concept["description"]
            if concept.get("group"):
                node.group = concept["group"]
            if concept.get("is_core"):
                node.is_core = True
            if concept.get("core_score") is not None and (node.core_score or 0) < concept["core_score"]:
                node.core_score = concept["core_score"]
        else:
            node = ConceptNode(
                project_id=project_id,
                file_id=file_id,
                concept_id=cid,
                subject_id=concept.get("subject_id", subject_id),
                name=node_name,
                description=concept.get("description"),
                group=concept.get("group"),
                status=NODE_STATUS_UNSEEN,
                understanding_score=concept.get("score", 0.5),
                understanding_level=concept.get("understanding_level", 3),
                confidence=concept.get("confidence", 0.0),
                diagnosis_count=concept.get("diagnosis_count", 0),
                core_score=concept.get("core_score"),
                is_core=concept.get("is_core", False),
                node_source=concept.get("node_source", "uploaded_pdf"),
            )
            db.add(node)

        db.flush()
        name_to_node[node_name] = node
        if cid:
            concept_id_to_node[cid] = node

    # 기존 엣지 미리 로드 — (source, target, relation_type) 기준 중복 방지
    existing_edges: set[tuple[str, str, str]] = {
        (e.source_node_id, e.target_node_id, e.relation_type)
        for e in db.query(ConceptEdge).filter(ConceptEdge.project_id == project_id).all()
    }

    for relation in ai_result.get("relations", []):
        source, target = _resolve_relation_nodes(
            relation=relation,
            concept_id_to_node=concept_id_to_node,
            name_to_node=name_to_node,
        )
        if not source or not target:
            continue

        relation_type = relation.get("relation_type", "part_of")
        key = (source.node_id, target.node_id, relation_type)
        if key in existing_edges:
            continue

        edge = ConceptEdge(
            project_id=project_id,
            source_node_id=source.node_id,
            target_node_id=target.node_id,
            relation_type=relation_type,
            edge_source_scope=relation.get("edge_source_scope", "uploaded_material"),
            weight=relation.get("weight", 1.0),
        )
        db.add(edge)
        existing_edges.add(key)

    db.commit()


def _get_concept_name(concept: dict) -> str | None:
    if concept.get("concept_name"):
        return concept["concept_name"]
    if concept.get("name"):
        return concept["name"]
    return None


def _resolve_relation_nodes(
    relation: dict,
    concept_id_to_node: dict[str, ConceptNode],
    name_to_node: dict[str, ConceptNode],
) -> tuple[ConceptNode | None, ConceptNode | None]:
    if relation.get("source_concept_id") or relation.get("target_concept_id"):
        source = concept_id_to_node.get(relation.get("source_concept_id"))
        target = concept_id_to_node.get(relation.get("target_concept_id"))
        return source, target

    source = name_to_node.get(relation.get("source"))
    target = name_to_node.get(relation.get("target"))
    return source, target
