from __future__ import annotations

import re
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.ai.concept_normalizer import ConceptNormalizerError, load_alias_dictionary
from app.models.chat import Chat
from app.models.concept_quiz_counter import ConceptQuizCounter
from app.models.graph import ConceptNode


TURN_CHECK_INTERVAL = 5
QUIZ_READY_MENTION_THRESHOLD = 5
SLIDING_WINDOW_ASSISTANT_MESSAGES = 5


@dataclass(frozen=True)
class MatchedConcept:
    node_id: str
    name: str
    mention_count: int
    concept_id: str | None = None


def _normalize_text(value: str | None) -> str:
    return re.sub(r"\s+", " ", value or "").strip().casefold()


def _normalize_compact(value: str | None) -> str:
    if not isinstance(value, str):
        return ""
    normalized = value.strip().casefold()
    normalized = re.sub(r"[\s\-_]+", "", normalized)
    normalized = re.sub(r"[^\w가-힣]", "", normalized)
    return normalized


def _concept_appears_once(answer_text: str, concept_name: str | None) -> bool:
    normalized_answer = _normalize_text(answer_text)
    normalized_concept = _normalize_text(concept_name)

    if not normalized_answer or not normalized_concept:
        return False

    return normalized_concept in normalized_answer


def _collect_alias_values(concept: dict) -> list[str]:
    values: list[str] = []
    for key in ("canonical_name", "korean_name"):
        value = concept.get(key)
        if isinstance(value, str) and value.strip():
            values.append(value)

    aliases = concept.get("aliases")
    if isinstance(aliases, list):
        values.extend(alias for alias in aliases if isinstance(alias, str) and alias.strip())

    return values


def _build_aliases_by_concept_id(nodes: list[ConceptNode]) -> dict[str, set[str]]:
    subject_ids = {node.subject_id for node in nodes if node.subject_id}
    aliases_by_concept_id: dict[str, set[str]] = {}

    for subject_id in subject_ids:
        try:
            alias_data = load_alias_dictionary(subject_id)
        except ConceptNormalizerError:
            continue

        for concept in alias_data.get("concepts", []):
            concept_id = concept.get("concept_id")
            if not isinstance(concept_id, str) or not concept_id:
                continue
            aliases_by_concept_id.setdefault(concept_id, set()).update(_collect_alias_values(concept))

    return aliases_by_concept_id


def _alias_appears(answer_text: str | None, alias: str | None) -> bool:
    normalized_answer = _normalize_compact(answer_text)
    normalized_alias = _normalize_compact(alias)

    if not normalized_answer or not normalized_alias:
        return False

    return normalized_alias in normalized_answer


def _concept_mentioned_in_answer(
    answer_text: str | None,
    node: ConceptNode,
    aliases_by_concept_id: dict[str, set[str]],
) -> bool:
    aliases = {node.name}
    if node.concept_id:
        aliases.update(aliases_by_concept_id.get(node.concept_id, set()))

    return any(_alias_appears(answer_text, alias) for alias in aliases)


def _get_or_create_counter(db: Session, project_id: int, node_id: str) -> ConceptQuizCounter:
    counter = (
        db.query(ConceptQuizCounter)
        .filter(
            ConceptQuizCounter.project_id == project_id,
            ConceptQuizCounter.node_id == node_id,
        )
        .first()
    )
    if counter:
        return counter

    counter = ConceptQuizCounter(
        project_id=project_id,
        node_id=node_id,
        mention_count=0,
    )
    db.add(counter)
    db.flush()
    return counter


def get_project_turn_count(db: Session, project_id: int) -> int:
    return db.query(Chat).filter(Chat.project_id == project_id).count()


def record_ai_response_concept_counts(
    db: Session,
    project_id: int,
    ai_response: str | None,
    chat_id: int | None = None,
) -> list[MatchedConcept]:
    nodes = db.query(ConceptNode).filter(ConceptNode.project_id == project_id).all()
    matched_nodes = [
        node
        for node in nodes
        if _concept_appears_once(ai_response, node.name)
    ]

    updated_concepts: list[MatchedConcept] = []
    seen_node_ids: set[str] = set()

    for node in matched_nodes:
        if node.node_id in seen_node_ids:
            continue

        seen_node_ids.add(node.node_id)
        counter = _get_or_create_counter(db, project_id, node.node_id)
        counter.mention_count = (counter.mention_count or 0) + 1
        counter.last_counted_chat_id = chat_id
        updated_concepts.append(
            MatchedConcept(
                node_id=node.node_id,
                name=node.name,
                mention_count=counter.mention_count,
                concept_id=node.concept_id,
            )
        )

    db.commit()
    return updated_concepts


def get_recent_assistant_messages(
    db: Session,
    project_id: int,
    session_id: int | None = None,
    limit: int = SLIDING_WINDOW_ASSISTANT_MESSAGES,
) -> list[Chat]:
    filters = [
        Chat.project_id == project_id,
        Chat.ai_response.isnot(None),
    ]
    if session_id is not None:
        filters.append(Chat.session_id == session_id)

    rows = (
        db.query(Chat)
        .filter(*filters)
        .order_by(Chat.created_at.desc(), Chat.chat_id.desc())
        .limit(limit)
        .all()
    )
    return list(reversed(rows))


def get_sliding_window_quiz_ready_concepts(
    db: Session,
    project_id: int,
    session_id: int | None = None,
    window_size: int = SLIDING_WINDOW_ASSISTANT_MESSAGES,
) -> list[MatchedConcept]:
    nodes = db.query(ConceptNode).filter(ConceptNode.project_id == project_id).all()
    counters = {
        counter.node_id: counter
        for counter in db.query(ConceptQuizCounter)
        .filter(ConceptQuizCounter.project_id == project_id)
        .all()
    }
    recent_messages = get_recent_assistant_messages(
        db=db,
        project_id=project_id,
        session_id=session_id,
        limit=window_size,
    )

    if not nodes or not recent_messages:
        return []

    aliases_by_concept_id = _build_aliases_by_concept_id(nodes)
    mention_counts: dict[str, int] = {node.node_id: 0 for node in nodes}

    for message in recent_messages:
        for node in nodes:
            counter = counters.get(node.node_id)
            if counter and counter.last_counted_chat_id and message.chat_id <= counter.last_counted_chat_id:
                continue
            if _concept_mentioned_in_answer(message.ai_response, node, aliases_by_concept_id):
                mention_counts[node.node_id] += 1

    ready_concepts = [
        MatchedConcept(
            node_id=node.node_id,
            name=node.name,
            mention_count=mention_counts[node.node_id],
            concept_id=node.concept_id,
        )
        for node in nodes
        if mention_counts[node.node_id] >= QUIZ_READY_MENTION_THRESHOLD
    ]
    ready_concepts.sort(key=lambda concept: (-concept.mention_count, concept.name))
    return ready_concepts


def get_quiz_ready_concepts(db: Session, project_id: int) -> list[MatchedConcept]:
    rows = (
        db.query(ConceptQuizCounter, ConceptNode)
        .join(ConceptNode, ConceptNode.node_id == ConceptQuizCounter.node_id)
        .filter(
            ConceptQuizCounter.project_id == project_id,
            ConceptQuizCounter.mention_count >= QUIZ_READY_MENTION_THRESHOLD,
        )
        .order_by(ConceptQuizCounter.mention_count.desc(), ConceptNode.name.asc())
        .all()
    )

    return [
        MatchedConcept(
            node_id=node.node_id,
            name=node.name,
            mention_count=counter.mention_count,
            concept_id=node.concept_id,
        )
        for counter, node in rows
    ]


def reset_concept_quiz_counter(db: Session, project_id: int, node_id: str) -> None:
    counter = _get_or_create_counter(db, project_id, node_id)
    latest_chat_id = (
        db.query(Chat.chat_id)
        .filter(
            Chat.project_id == project_id,
            Chat.ai_response.isnot(None),
        )
        .order_by(Chat.created_at.desc(), Chat.chat_id.desc())
        .limit(1)
        .scalar()
    )
    counter.mention_count = 0
    counter.last_counted_chat_id = latest_chat_id
