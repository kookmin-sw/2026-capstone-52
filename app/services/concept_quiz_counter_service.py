from __future__ import annotations

import re
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.models.chat import Chat
from app.models.concept_quiz_counter import ConceptQuizCounter
from app.models.graph import ConceptNode


TURN_CHECK_INTERVAL = 5
QUIZ_READY_MENTION_THRESHOLD = 5


@dataclass(frozen=True)
class MatchedConcept:
    node_id: str
    name: str
    mention_count: int


def _normalize_text(value: str | None) -> str:
    return re.sub(r"\s+", " ", value or "").strip().casefold()


def _concept_appears_once(answer_text: str, concept_name: str | None) -> bool:
    normalized_answer = _normalize_text(answer_text)
    normalized_concept = _normalize_text(concept_name)

    if not normalized_answer or not normalized_concept:
        return False

    return normalized_concept in normalized_answer


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
            )
        )

    db.commit()
    return updated_concepts


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
        )
        for counter, node in rows
    ]


def reset_concept_quiz_counter(db: Session, project_id: int, node_id: str) -> None:
    counter = (
        db.query(ConceptQuizCounter)
        .filter(
            ConceptQuizCounter.project_id == project_id,
            ConceptQuizCounter.node_id == node_id,
        )
        .first()
    )
    if counter:
        counter.mention_count = 0
