import json
import logging
import re
from functools import lru_cache
from pathlib import Path
from typing import Any


SUPPORTED_SUBJECT_IDS = {
    "operating_system",
    "data_structure",
    "computer_network",
    "algorithm",
}

BACKBONE_DIR = Path(__file__).resolve().parent.parent / "data" / "backbone"
STOPWORDS = {
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "in", "into",
    "is", "it", "of", "on", "or", "that", "the", "to", "with", "this", "these",
    "those", "their", "there", "then", "than", "if", "when", "while", "using",
    "use", "used", "can", "could", "should", "would", "will", "may", "might",
    "do", "does", "did", "done", "such", "also", "more", "most", "very", "not",
    "we", "you", "they", "he", "she", "i", "our", "your", "its", "about", "why",
    "what", "how",
}

logger = logging.getLogger(__name__)


# 백본 chunk 서비스
#
# 역할:
# - subject별로 미리 전처리된 backbone chunk JSON을 로드한다.
# - concept, question, related concept를 이용해 deterministic keyword/phrase retrieval을 수행한다.
# - explanation_service가 바로 넣을 수 있는 compact backbone_context 문자열을 만든다.
# - backbone 데이터가 없거나 일부 malformed여도 explanation 요청 자체는 실패시키지 않는다.
def load_backbone_chunks(subject_id: str) -> list[dict]:
    if subject_id not in SUPPORTED_SUBJECT_IDS:
        return []
    return list(_load_backbone_chunks_cached(subject_id))


def retrieve_backbone_chunks(
    *,
    subject_id: str | None,
    concept_id: str | None = None,
    concept_name: str | None = None,
    user_question: str | None = None,
    related_concepts: list[dict] | None = None,
    top_k: int = 3,
) -> list[dict]:
    if not subject_id or subject_id not in SUPPORTED_SUBJECT_IDS:
        return []

    chunks = load_backbone_chunks(subject_id)
    if not chunks:
        return []

    query_terms = _extract_query_terms(
        concept_id=concept_id,
        concept_name=concept_name,
        user_question=user_question,
        related_concepts=related_concepts,
    )
    query_phrases = _extract_query_phrases(
        concept_id=concept_id,
        concept_name=concept_name,
        user_question=user_question,
        related_concepts=related_concepts,
    )
    if not query_terms and not query_phrases:
        return []

    scored_chunks: list[dict] = []
    for chunk in chunks:
        score, matched_terms = _score_chunk(
            chunk,
            query_terms=query_terms,
            query_phrases=query_phrases,
            concept_id=concept_id,
            concept_name=concept_name,
        )
        if score <= 0:
            continue

        scored_chunk = dict(chunk)
        scored_chunk["retrieval_score"] = round(score, 4)
        scored_chunk["matched_terms"] = matched_terms
        scored_chunks.append(scored_chunk)

    scored_chunks.sort(
        key=lambda item: (
            -item.get("retrieval_score", 0.0),
            str(item.get("chunk_id", "")),
        )
    )
    return scored_chunks[: max(1, top_k)]


def build_backbone_context(chunks: list[dict], *, max_chars: int = 4000) -> str:
    if not chunks:
        return ""

    parts: list[str] = []
    total_length = 0

    for chunk in chunks:
        header_parts = []
        if chunk.get("source_title"):
            header_parts.append(str(chunk["source_title"]))
        if chunk.get("chapter"):
            header_parts.append(f"chapter={chunk['chapter']}")
        if chunk.get("section"):
            header_parts.append(f"section={chunk['section']}")
        page_start = chunk.get("page_start")
        page_end = chunk.get("page_end")
        if page_start is not None or page_end is not None:
            if page_start == page_end:
                header_parts.append(f"pages={page_start}")
            else:
                header_parts.append(f"pages={page_start}-{page_end}")

        header = " | ".join(header_parts)
        text = str(chunk.get("text") or "").strip()
        if not text:
            continue

        block = f"[Backbone Chunk]\n{header}\n{text}".strip() if header else f"[Backbone Chunk]\n{text}"
        remaining = max_chars - total_length
        if remaining <= 0:
            break

        if len(block) > remaining:
            truncated = block[: max(0, remaining - 3)].rstrip()
            if truncated:
                parts.append(f"{truncated}...")
            break

        parts.append(block)
        total_length += len(block) + 2

    return "\n\n".join(parts).strip()


def get_backbone_context(
    *,
    subject_id: str | None,
    concept_id: str | None = None,
    concept_name: str | None = None,
    user_question: str | None = None,
    related_concepts: list[dict] | None = None,
    top_k: int = 3,
    max_chars: int = 4000,
) -> str:
    if not subject_id or subject_id not in SUPPORTED_SUBJECT_IDS:
        return ""

    try:
        chunks = retrieve_backbone_chunks(
            subject_id=subject_id,
            concept_id=concept_id,
            concept_name=concept_name,
            user_question=user_question,
            related_concepts=related_concepts,
            top_k=top_k,
        )
        if not chunks:
            return ""
        return build_backbone_context(chunks, max_chars=max_chars)
    except Exception as error:
        logger.warning("backbone_context_retrieval_failed subject_id=%s error=%s", subject_id, error)
        return ""


def _backbone_file_for_subject(subject_id: str) -> Path | None:
    if subject_id not in SUPPORTED_SUBJECT_IDS:
        return None
    return BACKBONE_DIR / f"{subject_id}_chunks.json"


def _normalize_text(value: Any) -> str:
    if not isinstance(value, str):
        return ""
    normalized = value.strip().lower()
    normalized = normalized.replace("o(", "bigo(")
    normalized = re.sub(r"np[\s_-]*hard", "np-hard", normalized)
    normalized = re.sub(r"np[\s_-]*complete", "np-complete", normalized)
    normalized = re.sub(r"[\t\r\f\v]+", " ", normalized)
    normalized = re.sub(r"[^\w\s가-힣\-\+\.\(\)]", " ", normalized)
    normalized = re.sub(r"\s+", " ", normalized)
    return normalized.strip()


def _tokenize(value: str) -> set[str]:
    normalized = _normalize_text(value)
    if not normalized:
        return set()

    tokens = set(re.findall(r"[a-z0-9가-힣][a-z0-9가-힣\-\+\.\(\)]*", normalized))
    filtered = set()
    for token in tokens:
        if token in STOPWORDS:
            continue
        if len(token) == 1 and token not in {"c", "r"}:
            continue
        filtered.add(token)
    return filtered


def _extract_query_terms(
    *,
    concept_id: str | None,
    concept_name: str | None,
    user_question: str | None,
    related_concepts: list[dict] | None,
) -> set[str]:
    terms: set[str] = set()
    for raw_value in [concept_id, concept_name, user_question]:
        if isinstance(raw_value, str):
            terms.update(_tokenize(raw_value))

    for item in related_concepts or []:
        if not isinstance(item, dict):
            continue
        for raw_value in [item.get("concept_id"), item.get("concept_name"), item.get("name")]:
            if isinstance(raw_value, str):
                terms.update(_tokenize(raw_value))
    return terms


def _extract_query_phrases(
    *,
    concept_id: str | None,
    concept_name: str | None,
    user_question: str | None,
    related_concepts: list[dict] | None,
) -> set[str]:
    phrases: set[str] = set()
    for raw_value in [concept_id, concept_name]:
        normalized = _normalize_text(raw_value)
        if normalized:
            phrases.add(normalized)

    normalized_question = _normalize_text(user_question)
    if normalized_question:
        for piece in re.split(r"[?.!,;:]", normalized_question):
            piece = piece.strip()
            if len(piece) >= 6:
                phrases.add(piece)

    for item in related_concepts or []:
        if not isinstance(item, dict):
            continue
        for raw_value in [item.get("concept_name"), item.get("name")]:
            normalized = _normalize_text(raw_value)
            if normalized:
                phrases.add(normalized)
    return phrases


def _score_chunk(
    chunk: dict,
    query_terms: set[str],
    query_phrases: set[str],
    concept_id: str | None,
    concept_name: str | None,
) -> tuple[float, list[str]]:
    score = 0.0
    matched_terms: set[str] = set()

    chunk_concept_ids = {
        _normalize_text(item)
        for item in chunk.get("concept_ids", [])
        if isinstance(item, str)
    }
    normalized_concept_id = _normalize_text(concept_id)
    normalized_concept_name = _normalize_text(concept_name)

    source_title_text = _normalize_text(chunk.get("source_title"))
    chapter_text = _normalize_text(chunk.get("chapter"))
    section_text = _normalize_text(chunk.get("section"))
    text = _normalize_text(chunk.get("text"))

    title_terms = _tokenize(" ".join([source_title_text, chapter_text, section_text]))
    keyword_terms = set()
    keyword_phrases = set()
    for keyword in chunk.get("keywords", []):
        if isinstance(keyword, str):
            keyword_terms.update(_tokenize(keyword))
            normalized_keyword = _normalize_text(keyword)
            if normalized_keyword:
                keyword_phrases.add(normalized_keyword)

    text_terms = _tokenize(text)

    if normalized_concept_id and normalized_concept_id in chunk_concept_ids:
        score += 5.0
        matched_terms.add(normalized_concept_id)

    metadata_text = " ".join([source_title_text, chapter_text, section_text]).strip()
    if normalized_concept_name and normalized_concept_name and normalized_concept_name in metadata_text:
        score += 3.0
        matched_terms.add(normalized_concept_name)

    for phrase in query_phrases:
        if not phrase:
            continue
        if phrase in metadata_text:
            score += 2.5
            matched_terms.add(phrase)
        elif phrase in keyword_phrases:
            score += 2.0
            matched_terms.add(phrase)
        elif phrase in text:
            score += 1.2
            matched_terms.add(phrase)

    keyword_overlap = query_terms & keyword_terms
    metadata_overlap = query_terms & title_terms
    text_overlap = query_terms & text_terms

    score += len(keyword_overlap) * 2.0
    score += len(metadata_overlap) * 1.0
    score += min(len(text_overlap), 20) * 0.2
    matched_terms.update(keyword_overlap)
    matched_terms.update(metadata_overlap)
    matched_terms.update(set(list(text_overlap)[:10]))

    return min(score, 25.0), sorted(matched_terms)


def _coerce_chunk(raw: Any, fallback_subject_id: str) -> dict | None:
    if not isinstance(raw, dict):
        return None

    chunk_id = _coerce_optional_string(raw.get("chunk_id"))
    text = _coerce_optional_string(raw.get("text"))
    if not chunk_id or not text:
        return None

    return {
        "chunk_id": chunk_id,
        "subject_id": _coerce_optional_string(raw.get("subject_id")) or fallback_subject_id,
        "source_id": _coerce_optional_string(raw.get("source_id")) or "",
        "source_title": _coerce_optional_string(raw.get("source_title")) or "",
        "chapter": _coerce_optional_string(raw.get("chapter")) or "",
        "section": _coerce_optional_string(raw.get("section")) or "",
        "page_start": raw.get("page_start"),
        "page_end": raw.get("page_end"),
        "concept_ids": [item for item in raw.get("concept_ids", []) if isinstance(item, str)],
        "keywords": [item for item in raw.get("keywords", []) if isinstance(item, str)],
        "text": text,
    }


def _safe_json_load(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def _coerce_optional_string(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    stripped = value.strip()
    return stripped or None


@lru_cache(maxsize=None)
def _load_backbone_chunks_cached(subject_id: str) -> tuple[dict, ...]:
    path = _backbone_file_for_subject(subject_id)
    if path is None or not path.exists():
        return ()

    payload = _safe_json_load(path)
    if isinstance(payload, dict):
        raw_chunks = payload.get("chunks", [])
    elif isinstance(payload, list):
        raw_chunks = payload
    else:
        raw_chunks = []

    chunks: list[dict] = []
    for raw_chunk in raw_chunks:
        chunk = _coerce_chunk(raw_chunk, subject_id)
        if chunk:
            chunks.append(chunk)
    return tuple(chunks)
