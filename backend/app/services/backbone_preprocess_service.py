import io
import json
import logging
import re
from pathlib import Path
from typing import Any


SUPPORTED_SUBJECT_IDS = {
    "operating_system",
    "data_structure",
    "computer_network",
    "algorithm",
}

ALIASES_DIR = Path(__file__).resolve().parent.parent / "data" / "aliases"
logger = logging.getLogger(__name__)

STOPWORDS = {
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "in", "into",
    "is", "it", "of", "on", "or", "that", "the", "to", "with", "this", "these",
    "those", "their", "there", "then", "than", "if", "when", "while", "using",
    "use", "used", "can", "could", "should", "would", "will", "may", "might",
    "do", "does", "did", "done", "such", "also", "more", "most", "very", "not",
    "we", "you", "they", "he", "she", "i", "our", "your", "its", "about",
}

BROAD_SINGLE_WORD_ALIASES = {
    "tree", "node", "file", "page", "state", "memory", "network", "service",
    "policy", "block", "data", "value", "queue", "lock", "process", "thread",
    "array", "list", "set",
}

AUTO_TAGGING_BROAD_CONCEPT_IDS = {
    "data_structure": {
        "ds_node",
        "ds_pointer_reference",
        "ds_traversal",
        "ds_big_o_notation",
        "ds_dynamic_array",
        "ds_array",
        "ds_tree",
    }
}

MAX_CONCEPT_IDS_PER_CHUNK = 8

CHAPTER_HEADING_PATTERNS = [
    re.compile(r"^\s*chapter\s+\d+\b.*$", re.IGNORECASE),
    re.compile(r"^\s*part\s+[ivxlc]+\b.*$", re.IGNORECASE),
]


class BackbonePreprocessError(Exception):
    """Base exception for backbone preprocessing failures."""


class BackbonePDFExtractionError(BackbonePreprocessError):
    """Raised when PDF text extraction fails.""" 


class BackboneChunkingError(BackbonePreprocessError):
    """Raised when chunking cannot proceed safely."""


# PDF 페이지 추출 공개 함수
#
# 역할:
# - file bytes에서 페이지별 텍스트를 추출한다.
# - OCR 없이 text layer만 사용한다.
# - 비어 있는 페이지는 건너뛰고 page_number를 보존한다.
def extract_pdf_pages(file_bytes: bytes) -> list[dict]:
    try:
        import pdfplumber
    except ImportError as error:
        raise ImportError(
            "pdfplumber is required for backbone PDF preprocessing. "
            "Please install dependencies from requirements.txt."
        ) from error

    try:
        pages: list[dict] = []
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            for index, page in enumerate(pdf.pages, start=1):
                text = page.extract_text() or ""
                normalized = _normalize_whitespace(text)
                if not normalized:
                    continue
                pages.append(
                    {
                        "page_number": index,
                        "text": normalized,
                    }
                )
        return pages
    except Exception as error:
        raise BackbonePDFExtractionError(f"Failed to extract PDF pages: {error}") from error


# 페이지 기반 chunk 생성 공개 함수
#
# 역할:
# - 페이지 텍스트를 generic한 문단/문장 단위로 묶어 chunk를 만든다.
# - page_start/page_end를 보존하고 chunk 간 overlap을 유지한다.
# - 특정 교재 구조를 hard-code하지 않는다.
def chunk_pages(
    pages: list[dict],
    *,
    subject_id: str,
    source_id: str,
    source_title: str | None = None,
    target_chars: int = 1800,
    overlap_chars: int = 250,
    max_chars: int = 2600,
) -> list[dict]:
    validated_subject_id = _validate_subject_id(subject_id)
    if not pages:
        return []
    if target_chars <= 0 or max_chars <= 0 or overlap_chars < 0:
        raise BackboneChunkingError("target_chars, overlap_chars, and max_chars must be valid positive values.")
    if target_chars > max_chars:
        raise BackboneChunkingError("target_chars cannot exceed max_chars.")

    safe_source_id = _safe_source_id(source_id)
    if not safe_source_id:
        raise BackboneChunkingError("source_id must be a non-empty string.")

    units: list[dict[str, Any]] = []
    current_chapter = ""
    for page in pages:
        if not isinstance(page, dict):
            continue
        page_number = page.get("page_number")
        text = _normalize_whitespace(page.get("text", ""))
        if not isinstance(page_number, int) or not text:
            continue
        page_segments = _split_page_by_chapter_boundaries(text, current_chapter)
        for segment in page_segments:
            segment_text = _normalize_whitespace(segment.get("text", ""))
            if not segment_text:
                continue
            chapter_title = _normalize_whitespace(segment.get("chapter_title", "")) or current_chapter
            if chapter_title:
                current_chapter = chapter_title
            section_title = infer_section_title(segment_text)
            for unit_text in _split_text_units(segment_text):
                units.append(
                    {
                        "page_number": page_number,
                        "chapter_title": current_chapter,
                        "section_title": section_title,
                        "text": unit_text,
                    }
                )

    if not units:
        return []

    chunks: list[dict] = []
    buffer_text = ""
    buffer_page_start: int | None = None
    buffer_page_end: int | None = None
    buffer_chapter = ""
    buffer_section = ""
    buffer_has_fresh_content = False

    def flush_buffer(*, keep_overlap: bool = True) -> None:
        nonlocal buffer_text, buffer_page_start, buffer_page_end, buffer_chapter, buffer_section, buffer_has_fresh_content
        normalized_text = _normalize_whitespace(buffer_text)
        if not normalized_text or buffer_page_start is None or buffer_page_end is None or not buffer_has_fresh_content:
            buffer_text = ""
            buffer_page_start = None
            buffer_page_end = None
            buffer_chapter = ""
            buffer_section = ""
            buffer_has_fresh_content = False
            return

        chunk_index = len(chunks) + 1
        chunks.append(
            {
                "chunk_id": f"{validated_subject_id}_{safe_source_id}_{chunk_index:04d}",
                "subject_id": validated_subject_id,
                "source_id": safe_source_id,
                "source_title": source_title or "",
                "chapter": buffer_chapter,
                "section": buffer_section,
                "page_start": buffer_page_start,
                "page_end": buffer_page_end,
                "concept_ids": [],
                "keywords": build_chunk_keywords(normalized_text),
                "text": normalized_text,
            }
        )

        overlap_text = _make_overlap_text(normalized_text, overlap_chars) if keep_overlap else ""
        buffer_text = overlap_text
        buffer_page_start = buffer_page_end
        buffer_section = ""
        buffer_has_fresh_content = False

    for unit in units:
        unit_text = unit["text"]
        unit_page = unit["page_number"]
        unit_chapter = unit.get("chapter_title", "")
        unit_section = unit["section_title"]

        if buffer_page_start is None:
            buffer_page_start = unit_page
            buffer_page_end = unit_page
            buffer_chapter = unit_chapter
            buffer_section = unit_section
        elif unit_chapter and buffer_chapter and unit_chapter != buffer_chapter:
            flush_buffer(keep_overlap=False)
            buffer_page_start = unit_page
            buffer_page_end = unit_page
            buffer_chapter = unit_chapter
            buffer_section = unit_section
        elif unit_chapter and not buffer_chapter:
            buffer_chapter = unit_chapter

        candidate_text = f"{buffer_text}\n\n{unit_text}".strip() if buffer_text else unit_text
        if len(candidate_text) > max_chars and buffer_text:
            flush_buffer()
            if buffer_page_start is None:
                buffer_page_start = unit_page
                buffer_page_end = unit_page
                buffer_chapter = unit_chapter
                buffer_section = unit_section
            candidate_text = f"{buffer_text}\n\n{unit_text}".strip() if buffer_text else unit_text

        buffer_text = candidate_text
        buffer_page_end = unit_page
        if unit_chapter and not buffer_chapter:
            buffer_chapter = unit_chapter
        if not buffer_section and unit_section:
            buffer_section = unit_section
        buffer_has_fresh_content = True

        if len(buffer_text) >= target_chars:
            flush_buffer()

    if _normalize_whitespace(buffer_text):
        flush_buffer()

    return chunks


# keyword 생성 공개 함수
#
# 역할:
# - chunk 텍스트에서 deterministic keyword와 간단한 phrase 후보를 뽑는다.
# - LLM이나 교재별 규칙 없이 CS 문맥에서 자주 쓰는 토큰을 최대한 살린다.
def build_chunk_keywords(text: str, *, max_keywords: int = 20) -> list[str]:
    normalized = _normalize_whitespace(text).lower()
    if not normalized:
        return []

    token_pattern = re.compile(r"[a-z0-9][a-z0-9\-\+\.\(\)]*")
    tokens = token_pattern.findall(normalized)
    counts: dict[str, int] = {}
    for token in tokens:
        if token in STOPWORDS:
            continue
        if len(token) == 1 and token not in {"c", "r"}:
            continue
        counts[token] = counts.get(token, 0) + 1

    phrases: list[str] = []
    for pattern in [
        r"dynamic programming",
        r"shortest path",
        r"divide and conquer",
        r"binary search",
        r"minimum spanning tree",
        r"breadth first search",
        r"depth first search",
        r"big o",
        r"o\(n log n\)",
        r"np-hard",
        r"np-complete",
    ]:
        if re.search(pattern, normalized):
            phrases.append(pattern.replace("\\", ""))

    ranked_terms = sorted(
        counts.items(),
        key=lambda item: (-item[1], item[0]),
    )
    keywords = phrases + [term for term, _ in ranked_terms]

    unique_keywords: list[str] = []
    seen = set()
    for keyword in keywords:
        if keyword in seen:
            continue
        seen.add(keyword)
        unique_keywords.append(keyword)
        if len(unique_keywords) >= max_keywords:
            break
    return unique_keywords


# 섹션 제목 추정 공개 함수
#
# 역할:
# - 페이지 앞부분의 짧고 heading처럼 보이는 줄을 generic하게 추정한다.
# - 특정 교재 구조를 hard-code하지 않고 불확실하면 빈 문자열을 반환한다.
def infer_section_title(page_text: str) -> str:
    lines = [line.strip() for line in str(page_text).splitlines() if line.strip()]
    for line in lines[:8]:
        compact = _normalize_whitespace(line)
        if not compact:
            continue
        word_count = len(compact.split(" "))
        if len(compact) <= 90 and word_count <= 10:
            if compact.isupper():
                return compact.title()
            if re.match(r"^(\d+(\.\d+)*)\s+\S+", compact):
                return compact
            if line == line.title():
                return compact
    return ""


# PDF -> chunk orchestration 공개 함수
#
# 역할:
# - PDF bytes에서 페이지를 추출하고 chunk를 생성한다.
def preprocess_pdf_to_chunks(
    file_bytes: bytes,
    *,
    subject_id: str,
    source_id: str,
    source_title: str | None = None,
    target_chars: int = 1800,
    overlap_chars: int = 250,
    max_chars: int = 2600,
    start_page: int | None = None,
    end_page: int | None = None,
) -> list[dict]:
    pages = extract_pdf_pages(file_bytes)
    filtered_pages = _filter_pages_by_range(
        pages,
        start_page=start_page,
        end_page=end_page,
    )
    chunks = chunk_pages(
        filtered_pages,
        subject_id=subject_id,
        source_id=source_id,
        source_title=source_title,
        target_chars=target_chars,
        overlap_chars=overlap_chars,
        max_chars=max_chars,
    )
    return assign_concept_ids_to_chunks(chunks, subject_id)


# chunk JSON 저장 공개 함수
#
# 역할:
# - {"chunks": chunks} 구조로 UTF-8 JSON을 저장한다.
def write_chunks_json(chunks: list[dict], output_path: str | Path) -> Path:
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps({"chunks": chunks}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return path


def assign_concept_ids_to_chunks(chunks: list[dict], subject_id: str) -> list[dict]:
    concepts = _load_alias_concepts(subject_id)
    if not concepts:
        for chunk in chunks:
            if isinstance(chunk, dict):
                chunk["concept_ids"] = list(chunk.get("concept_ids", []))
        return chunks

    compiled_concepts = []
    for concept in concepts:
        compiled = _compile_alias_concept(concept)
        if compiled:
            compiled_concepts.append(compiled)

    for chunk in chunks:
        if not isinstance(chunk, dict):
            continue
        normalized_text = _normalize_match_text(chunk.get("text", ""))
        normalized_chapter = _normalize_match_text(chunk.get("chapter", ""))
        normalized_section = _normalize_match_text(chunk.get("section", ""))
        concept_ids = list(chunk.get("concept_ids", [])) if isinstance(chunk.get("concept_ids"), list) else []
        seen = {value for value in concept_ids if isinstance(value, str)}

        scored_matches: list[tuple[float, str]] = []
        for concept in compiled_concepts:
            score = _score_concept_match(
                normalized_text=normalized_text,
                normalized_chapter=normalized_chapter,
                normalized_section=normalized_section,
                concept=concept,
                subject_id=subject_id,
            )
            if score <= 0:
                continue
            scored_matches.append((score, concept["concept_id"]))

        scored_matches.sort(key=lambda item: (-item[0], item[1]))
        for _, concept_id in scored_matches[:MAX_CONCEPT_IDS_PER_CHUNK]:
            if concept_id not in seen:
                concept_ids.append(concept_id)
                seen.add(concept_id)

        chunk["concept_ids"] = concept_ids[:MAX_CONCEPT_IDS_PER_CHUNK]

    return chunks


def _normalize_whitespace(text: str) -> str:
    if not isinstance(text, str):
        return ""
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _filter_pages_by_range(
    pages: list[dict],
    *,
    start_page: int | None,
    end_page: int | None,
) -> list[dict]:
    if start_page is not None and start_page < 1:
        raise BackboneChunkingError("start_page must be 1 or greater.")
    if end_page is not None and end_page < 1:
        raise BackboneChunkingError("end_page must be 1 or greater.")
    if start_page is not None and end_page is not None and start_page > end_page:
        raise BackboneChunkingError("start_page cannot exceed end_page.")
    if start_page is None and end_page is None:
        return pages

    filtered: list[dict] = []
    for page in pages:
        page_number = page.get("page_number")
        if not isinstance(page_number, int):
            continue
        if start_page is not None and page_number < start_page:
            continue
        if end_page is not None and page_number > end_page:
            continue
        filtered.append(page)
    return filtered


def _split_page_by_chapter_boundaries(text: str, current_chapter: str) -> list[dict]:
    lines = [line.rstrip() for line in str(text).splitlines()]
    if not lines:
        return [{"chapter_title": current_chapter, "text": text}]

    segments: list[dict] = []
    buffer: list[str] = []
    active_chapter = current_chapter
    index = 0

    while index < len(lines):
        chapter_title, consumed = _extract_chapter_heading(lines, index)
        if chapter_title:
            segment_text = _normalize_whitespace("\n".join(buffer))
            if segment_text:
                segments.append({"chapter_title": active_chapter, "text": segment_text})
            active_chapter = chapter_title
            buffer = []
            index += consumed
            continue

        buffer.append(lines[index])
        index += 1

    segment_text = _normalize_whitespace("\n".join(buffer))
    if segment_text:
        segments.append({"chapter_title": active_chapter, "text": segment_text})

    return segments or [{"chapter_title": current_chapter, "text": text}]


def _split_text_units(text: str) -> list[str]:
    normalized = _normalize_whitespace(text)
    if not normalized:
        return []

    paragraphs = [part.strip() for part in normalized.split("\n\n") if part.strip()]
    units: list[str] = []
    for paragraph in paragraphs:
        if len(paragraph) <= 900:
            units.append(paragraph)
            continue

        sentence_parts = re.split(r"(?<=[.!?])\s+|\n", paragraph)
        current = ""
        for sentence in sentence_parts:
            sentence = sentence.strip()
            if not sentence:
                continue
            candidate = f"{current} {sentence}".strip() if current else sentence
            if len(candidate) > 900 and current:
                units.append(current)
                current = sentence
            else:
                current = candidate
        if current:
            units.append(current)

    return units


def _make_overlap_text(text: str, overlap_chars: int) -> str:
    if overlap_chars <= 0:
        return ""
    normalized = _normalize_whitespace(text)
    if len(normalized) <= overlap_chars:
        return normalized
    return normalized[-overlap_chars:].strip()


def _safe_source_id(value: str) -> str:
    normalized = _normalize_whitespace(value).lower().replace(" ", "_")
    normalized = re.sub(r"[^a-z0-9_]+", "_", normalized)
    normalized = re.sub(r"_+", "_", normalized).strip("_")
    return normalized


def _validate_subject_id(subject_id: str) -> str:
    if subject_id not in SUPPORTED_SUBJECT_IDS:
        raise BackboneChunkingError(f"Unsupported subject_id: {subject_id}")
    return subject_id


def _alias_path_for_subject(subject_id: str) -> Path:
    return ALIASES_DIR / f"{subject_id}_aliases.json"


def _load_alias_concepts(subject_id: str) -> list[dict]:
    try:
        _validate_subject_id(subject_id)
        path = _alias_path_for_subject(subject_id)
        if not path.exists():
            logger.warning("backbone_alias_dictionary_missing subject_id=%s path=%s", subject_id, path)
            return []
        data = json.loads(path.read_text(encoding="utf-8"))
        concepts = data.get("concepts", []) if isinstance(data, dict) else []
        if not isinstance(concepts, list):
            logger.warning("backbone_alias_dictionary_invalid subject_id=%s reason=concepts_not_list", subject_id)
            return []
        valid_concepts = []
        for concept in concepts:
            if isinstance(concept, dict) and isinstance(concept.get("concept_id"), str):
                valid_concepts.append(concept)
        return valid_concepts
    except Exception as error:
        logger.warning("backbone_alias_dictionary_load_failed subject_id=%s error=%s", subject_id, error)
        return []


def _compile_alias_concept(concept: dict) -> dict | None:
    concept_id = concept.get("concept_id")
    if not isinstance(concept_id, str) or not concept_id:
        return None

    candidates: list[tuple[str, str]] = []
    canonical_name = concept.get("canonical_name")
    korean_name = concept.get("korean_name")
    if isinstance(canonical_name, str) and canonical_name.strip():
        candidates.append(("canonical_name", canonical_name))
    if isinstance(korean_name, str) and korean_name.strip():
        candidates.append(("korean_name", korean_name))
    for alias in concept.get("aliases", []):
        if isinstance(alias, str) and alias.strip():
            candidates.append(("alias", alias))

    seen = set()
    phrases: list[dict] = []
    single_words: list[dict] = []
    for source, raw in candidates:
        normalized = _normalize_match_text(raw)
        key = (source, normalized)
        if not normalized or key in seen:
            continue
        seen.add(key)

        if _is_multi_word_alias(raw, normalized):
            phrases.append(
                {
                    "normalized": normalized,
                    "source": source,
                }
            )
            continue

        single_words.append(
            {
                "normalized": normalized,
                "pattern": _build_single_word_pattern(raw, normalized),
                "is_acronym": _is_upper_acronym(raw),
                "source": source,
                "is_broad_alias": normalized in BROAD_SINGLE_WORD_ALIASES,
            }
        )

    return {
        "concept_id": concept_id,
        "canonical_name": _normalize_match_text(canonical_name),
        "korean_name": _normalize_match_text(korean_name),
        "phrases": phrases,
        "single_words": single_words,
    }


def _normalize_match_text(value: Any) -> str:
    if not isinstance(value, str):
        return ""
    text = value.lower()
    text = re.sub(r"[\u2010-\u2015]", "-", text)
    text = text.replace("-", " ")
    text = re.sub(r"[\t\r\n]+", " ", text)
    text = re.sub(r"[^\w\s가-힣]", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def _is_multi_word_alias(raw: str, normalized: str) -> bool:
    return (" " in normalized) or ("-" in raw)


def _is_upper_acronym(raw: str) -> bool:
    stripped = re.sub(r"[^A-Za-z0-9]", "", raw)
    if len(stripped) < 2:
        return False
    letters = re.sub(r"[^A-Za-z]", "", stripped)
    return bool(letters) and letters.isupper()


def _build_single_word_pattern(raw: str, normalized: str) -> re.Pattern[str]:
    if re.search(r"[A-Za-z0-9]", raw):
        return re.compile(rf"(?<![a-z0-9]){re.escape(normalized)}(?![a-z0-9])")
    return re.compile(rf"(?<![가-힣]){re.escape(normalized)}(?![가-힣])")


def _extract_chapter_heading(lines: list[str], index: int) -> tuple[str, int]:
    line = _normalize_whitespace(lines[index])
    if not line:
        return "", 1

    if _looks_like_chapter_heading(line):
        return line, 1

    if index + 1 < len(lines):
        combined = _normalize_whitespace(f"{line} {lines[index + 1]}")
        if _looks_like_chapter_heading(combined):
            return combined, 2

    return "", 1


def _looks_like_chapter_heading(value: str) -> bool:
    compact = _normalize_whitespace(value)
    if not compact or len(compact) > 120:
        return False
    return any(pattern.match(compact) for pattern in CHAPTER_HEADING_PATTERNS)


def _score_concept_match(
    *,
    normalized_text: str,
    normalized_chapter: str,
    normalized_section: str,
    concept: dict,
    subject_id: str,
) -> float:
    if not normalized_text:
        return 0.0
    if concept["concept_id"] in AUTO_TAGGING_BROAD_CONCEPT_IDS.get(subject_id, set()):
        return 0.0

    score = 0.0

    for phrase in concept["phrases"]:
        normalized_phrase = phrase["normalized"]
        occurrences = normalized_text.count(normalized_phrase)
        if occurrences <= 0:
            continue

        candidate_score = 3.0 + min(occurrences, 3) * 0.5
        if phrase["source"] in {"canonical_name", "korean_name"}:
            candidate_score += 0.5
        if normalized_phrase and normalized_chapter and normalized_phrase in normalized_chapter:
            candidate_score += 3.0
        if normalized_phrase and normalized_section and normalized_phrase in normalized_section:
            candidate_score += 1.0
        score = max(score, candidate_score)

    for candidate in concept["single_words"]:
        matches = candidate["pattern"].findall(normalized_text)
        if not matches:
            continue

        occurrences = len(matches)
        normalized_word = candidate["normalized"]
        in_chapter = bool(normalized_word and normalized_chapter and normalized_word in normalized_chapter)
        in_section = bool(normalized_word and normalized_section and normalized_word in normalized_section)
        is_canonical_or_korean = candidate["source"] in {"canonical_name", "korean_name"}

        if candidate["is_broad_alias"]:
            if not (occurrences >= 3 or in_chapter):
                continue
        elif not candidate["is_acronym"] and len(normalized_word) < 4 and occurrences < 2 and not in_chapter:
            continue

        candidate_score = 0.0
        if candidate["is_acronym"]:
            candidate_score += 2.0
        else:
            candidate_score += 1.0
        if is_canonical_or_korean:
            candidate_score += 2.0
        candidate_score += min(occurrences, 4) * 0.5
        if in_chapter:
            candidate_score += 3.0
        if in_section:
            candidate_score += 1.0

        score = max(score, candidate_score)

    return score
