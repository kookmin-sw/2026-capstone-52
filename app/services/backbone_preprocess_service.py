import io
import json
import re
from pathlib import Path
from typing import Any


SUPPORTED_SUBJECT_IDS = {
    "operating_system",
    "data_structure",
    "computer_network",
    "algorithm",
}

STOPWORDS = {
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "in", "into",
    "is", "it", "of", "on", "or", "that", "the", "to", "with", "this", "these",
    "those", "their", "there", "then", "than", "if", "when", "while", "using",
    "use", "used", "can", "could", "should", "would", "will", "may", "might",
    "do", "does", "did", "done", "such", "also", "more", "most", "very", "not",
    "we", "you", "they", "he", "she", "i", "our", "your", "its", "about",
}


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
    for page in pages:
        if not isinstance(page, dict):
            continue
        page_number = page.get("page_number")
        text = _normalize_whitespace(page.get("text", ""))
        if not isinstance(page_number, int) or not text:
            continue
        section_title = infer_section_title(text)
        for unit_text in _split_text_units(text):
            units.append(
                {
                    "page_number": page_number,
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
    buffer_section = ""

    def flush_buffer() -> None:
        nonlocal buffer_text, buffer_page_start, buffer_page_end, buffer_section
        normalized_text = _normalize_whitespace(buffer_text)
        if not normalized_text or buffer_page_start is None or buffer_page_end is None:
            buffer_text = ""
            buffer_page_start = None
            buffer_page_end = None
            buffer_section = ""
            return

        chunk_index = len(chunks) + 1
        chunks.append(
            {
                "chunk_id": f"{validated_subject_id}_{safe_source_id}_{chunk_index:04d}",
                "subject_id": validated_subject_id,
                "source_id": safe_source_id,
                "source_title": source_title or "",
                "chapter": "",
                "section": buffer_section,
                "page_start": buffer_page_start,
                "page_end": buffer_page_end,
                "concept_ids": [],
                "keywords": build_chunk_keywords(normalized_text),
                "text": normalized_text,
            }
        )

        overlap_text = _make_overlap_text(normalized_text, overlap_chars)
        buffer_text = overlap_text
        buffer_page_start = buffer_page_end
        buffer_section = buffer_section

    for unit in units:
        unit_text = unit["text"]
        unit_page = unit["page_number"]
        unit_section = unit["section_title"]

        if buffer_page_start is None:
            buffer_page_start = unit_page
            buffer_page_end = unit_page
            buffer_section = unit_section

        candidate_text = f"{buffer_text}\n\n{unit_text}".strip() if buffer_text else unit_text
        if len(candidate_text) > max_chars and buffer_text:
            flush_buffer()
            if buffer_page_start is None:
                buffer_page_start = unit_page
                buffer_section = unit_section
            candidate_text = f"{buffer_text}\n\n{unit_text}".strip() if buffer_text else unit_text

        buffer_text = candidate_text
        buffer_page_end = unit_page
        if not buffer_section and unit_section:
            buffer_section = unit_section

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
) -> list[dict]:
    pages = extract_pdf_pages(file_bytes)
    return chunk_pages(
        pages,
        subject_id=subject_id,
        source_id=source_id,
        source_title=source_title,
        target_chars=target_chars,
        overlap_chars=overlap_chars,
        max_chars=max_chars,
    )


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


def _normalize_whitespace(text: str) -> str:
    if not isinstance(text, str):
        return ""
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


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
