# [AI팀 구현] PDF 분석 → 개념/관계 추출

from __future__ import annotations

import io
import json
import re
from collections import Counter

import boto3
import pdfplumber

from app.core.config import settings

MAX_CONCEPTS = 12
DEFAULT_GROUP = "문서 핵심 개념"
MAX_LLM_CANDIDATES = 24
MAX_LLM_CHARS = 6000
GENERIC_TITLES = {
    "목차",
    "차례",
    "서론",
    "결론",
    "요약",
    "참고문헌",
    "부록",
    "개요",
    "정리",
    "contents",
    "appendix",
}
STOPWORDS = {
    "본",
    "이",
    "그",
    "및",
    "또는",
    "학습",
    "내용",
    "설명",
    "예시",
    "문제",
    "정의",
    "활용",
    "기본",
    "심화",
    "핵심",
    "개념",
    "문서",
    "자료",
    "학생",
    "학습자",
    "chapter",
    "section",
}
BAD_NAME_PARTS = {
    "하고",
    "하며",
    "에서",
    "대한",
    "통한",
    "위한",
    "저장하고",
    "반환",
    "처리",
    "기록",
    "생성",
    "조회",
    "업데이트",
    "호출",
    "요청",
    "응답",
}
HEADING_PREFIX_RE = re.compile(
    r"^(?:제\s*\d+\s*[장절]\s*|[0-9]+(?:\.[0-9]+){0,2}\s*[\.\)]?\s*|[A-Za-z가-힣]\)\s*|[•·\-]\s*)"
)
DEFINITION_RE = re.compile(
    r"([A-Za-z가-힣0-9][A-Za-z가-힣0-9\s\-/]{1,28}?)(?:은|는|이란|란|이|가)\s"
)


def extract_graph(file_bytes: bytes) -> dict:
    """PDF 바이트를 받아 초기 개념 그래프를 생성해 반환한다.

    역할 범위:
    - 초기 개념 구조만 생성한다.
    - 사용자 지식 상태, 사용자 score, 진단/채팅 기반 업데이트는 여기서 처리하지 않는다.

    현재 파이프라인:
    1. PDF 텍스트/페이지 추출
    2. 문서 구조(heading stack) 구성
    3. 휴리스틱으로 넓게 개념 후보 생성
    4. Bedrock 사용 가능 시 LLM으로 개념 정제
    5. 규칙 기반 후처리/검증
    6. part_of 중심 관계 생성, prerequisite는 보수적으로 제한
    """
    pages = _extract_pages(file_bytes)
    if not pages:
        return _fallback_graph()

    lines = _build_line_records(pages)
    candidates = _generate_candidates(pages, lines)
    if not candidates:
        return _fallback_graph()

    target_count = _estimate_target_concept_count(pages)
    llm_concepts = _refine_concepts_with_llm(pages, candidates, target_count)
    if llm_concepts:
        concepts = _post_validate_concepts(llm_concepts, candidates, pages, lines, target_count)
    else:
        concepts = _select_concepts_heuristically(candidates, pages, lines, target_count)

    if not concepts:
        return _fallback_graph()

    relations = _build_relations(concepts, lines)
    return {"concepts": concepts, "relations": relations}


def _extract_pages(file_bytes: bytes) -> list[str]:
    if not file_bytes:
        return []

    try:
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            pages = []
            for page in pdf.pages:
                text = page.extract_text() or ""
                cleaned = text.replace("\x00", "").strip()
                if cleaned:
                    pages.append(cleaned)
            return pages
    except Exception:
        return []


def _build_line_records(pages: list[str]) -> list[dict]:
    records: list[dict] = []
    heading_stack: list[tuple[int, str]] = []

    for page_index, page_text in enumerate(pages):
        for line_index, raw_line in enumerate(page_text.splitlines()):
            line = _normalize_whitespace(raw_line)
            if not line:
                continue

            heading = _detect_heading(line)
            parent_group = heading_stack[-1][1] if heading_stack else DEFAULT_GROUP

            if heading:
                level = heading["level"]
                title = heading["title"]
                while heading_stack and heading_stack[-1][0] >= level:
                    heading_stack.pop()
                parent_group = heading_stack[-1][1] if heading_stack else DEFAULT_GROUP
                heading_stack.append((level, title))

            records.append(
                {
                    "page_index": page_index,
                    "line_index": line_index,
                    "line": line,
                    "heading": heading,
                    "active_group": heading_stack[-1][1] if heading_stack else DEFAULT_GROUP,
                    "parent_group": parent_group,
                }
            )

    return records


def _generate_candidates(pages: list[str], lines: list[dict]) -> list[dict]:
    candidates = []
    candidates.extend(_extract_heading_candidates(lines))
    candidates.extend(_extract_definition_candidates(lines))
    candidates.extend(_extract_inline_candidates(pages, lines))
    return _merge_candidate_pool(candidates, pages, lines)


def _extract_heading_candidates(lines: list[dict]) -> list[dict]:
    candidates: list[dict] = []
    for record in lines:
        heading = record["heading"]
        if not heading:
            continue

        title = heading["title"]
        score = _score_candidate_name(title)
        if score <= 0:
            continue

        candidates.append(
            {
                "name": title,
                "group": record["parent_group"] if record["parent_group"] != title else DEFAULT_GROUP,
                "description": "",
                "score": score + (3 if heading["level"] <= 2 else 2),
                "page_index": record["page_index"],
                "line_index": record["line_index"],
                "source": "heading",
            }
        )
    return candidates


def _extract_definition_candidates(lines: list[dict]) -> list[dict]:
    candidates: list[dict] = []
    for record in lines:
        sentence = record["line"]
        for match in DEFINITION_RE.finditer(sentence):
            name = _clean_candidate_name(match.group(1))
            score = _score_candidate_name(name)
            if score <= 0:
                continue

            candidates.append(
                {
                    "name": name,
                    "group": record["active_group"] if record["active_group"] != name else record["parent_group"],
                    "description": _clip_description(sentence),
                    "score": score + 2,
                    "page_index": record["page_index"],
                    "line_index": record["line_index"],
                    "source": "definition",
                }
            )
    return candidates


def _extract_inline_candidates(pages: list[str], lines: list[dict]) -> list[dict]:
    candidates: list[dict] = []
    for page_index, page_text in enumerate(pages):
        for sentence in _split_sentences(page_text):
            for term in _extract_inline_terms(sentence):
                score = _score_candidate_name(term)
                if score <= 1:
                    continue

                group = _find_group_for_sentence(page_index, sentence, lines)
                candidates.append(
                    {
                        "name": term,
                        "group": group if group != term else DEFAULT_GROUP,
                        "description": _clip_description(sentence),
                        "score": score,
                        "page_index": page_index,
                        "line_index": 0,
                        "source": "inline",
                    }
                )
    return candidates


def _merge_candidate_pool(candidates: list[dict], pages: list[str], lines: list[dict]) -> list[dict]:
    merged: dict[str, dict] = {}
    score_counter: Counter[str] = Counter()

    for candidate in candidates:
        name = candidate["name"]
        score_counter[name] += candidate["score"]
        existing = merged.get(name)
        if not existing:
            merged[name] = candidate.copy()
            continue

        if not existing["description"] and candidate["description"]:
            existing["description"] = candidate["description"]
        if existing["group"] == DEFAULT_GROUP and candidate["group"] != DEFAULT_GROUP:
            existing["group"] = candidate["group"]
        if candidate["source"] == "heading" and existing["source"] != "heading":
            existing["source"] = "heading"
            existing["page_index"] = candidate["page_index"]
            existing["line_index"] = candidate["line_index"]

    for name, data in merged.items():
        data["score"] = score_counter[name]
        if not data["description"]:
            data["description"] = _build_description_from_context(data, lines)
        if not data["description"]:
            data["description"] = _build_description_from_pages(name, pages)
        if not data["description"]:
            data["description"] = f"{name}의 핵심 개념과 역할을 다루는 학습 단위이다."
        data["group"] = _normalize_group_name(data["group"])

    ranked = sorted(
        merged.values(),
        key=lambda item: (-item["score"], item["page_index"], item["line_index"], len(item["name"])),
    )
    return ranked[:MAX_LLM_CANDIDATES]


def _refine_concepts_with_llm(pages: list[str], candidates: list[dict], target_count: int) -> list[dict] | None:
    prompt = _build_llm_prompt(pages, candidates, target_count)
    if not prompt:
        return None

    try:
        client = boto3.client("bedrock-runtime", region_name=settings.aws_region)
        body = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 1400,
            "temperature": 0,
            "messages": [{"role": "user", "content": [{"type": "text", "text": prompt}]}],
        }
        response = client.invoke_model(
            modelId=settings.bedrock_model_id,
            body=json.dumps(body),
            contentType="application/json",
            accept="application/json",
        )
        payload = json.loads(response["body"].read())
        text_parts = []
        for item in payload.get("content", []):
            if item.get("type") == "text":
                text_parts.append(item.get("text", ""))
        return _parse_llm_concepts("\n".join(text_parts))
    except Exception:
        return None


def _build_llm_prompt(pages: list[str], candidates: list[dict], target_count: int) -> str:
    if not candidates:
        return ""

    excerpts = []
    used = 0
    for page_index, page_text in enumerate(pages[:6], start=1):
        snippet = _normalize_whitespace(page_text)[:900]
        if not snippet:
            continue
        piece = f"[Page {page_index}]\n{snippet}\n"
        if used + len(piece) > MAX_LLM_CHARS:
            break
        excerpts.append(piece)
        used += len(piece)

    candidate_lines = []
    for candidate in candidates[:MAX_LLM_CANDIDATES]:
        candidate_lines.append(
            f"- name={candidate['name']} | group={candidate['group']} | score={candidate['score']} | source={candidate['source']}"
        )

    return (
        "You are extracting an initial learning concept graph from a PDF.\n"
        "Use only the document evidence and candidate list below.\n"
        "Do not invent concepts that are not supported by the document.\n"
        "Select real learning concepts, remove noisy API/operation fragments, merge duplicates,\n"
        "and assign each concept a short description and a group that matches chapter/section/topic when possible.\n"
        f"Return about {target_count} concepts, never more than {MAX_CONCEPTS}.\n"
        "Do not return relations.\n"
        "Return JSON only in this exact shape:\n"
        '{"concepts":[{"name":"...", "description":"...", "group":"..."}]}\n\n'
        "Document excerpts:\n"
        f"{''.join(excerpts)}\n"
        "Candidate concepts:\n"
        f"{chr(10).join(candidate_lines)}"
    )


def _parse_llm_concepts(text: str) -> list[dict] | None:
    if not text:
        return None

    match = re.search(r"\{.*\}", text, re.DOTALL)
    raw_json = match.group(0) if match else text.strip()

    try:
        payload = json.loads(raw_json)
    except json.JSONDecodeError:
        return None

    concepts = payload.get("concepts")
    if not isinstance(concepts, list):
        return None

    result = []
    for item in concepts:
        if not isinstance(item, dict):
            continue
        result.append(
            {
                "name": _clean_candidate_name(str(item.get("name", ""))),
                "description": _clip_description(str(item.get("description", ""))),
                "group": _normalize_group_name(str(item.get("group", "")) or DEFAULT_GROUP),
            }
        )
    return result or None


def _post_validate_concepts(
    concepts: list[dict], candidates: list[dict], pages: list[str], lines: list[dict], target_count: int
) -> list[dict]:
    candidate_map = {item["name"]: item for item in candidates}
    validated = []
    seen = set()

    for concept in concepts:
        name = _clean_candidate_name(concept["name"])
        if name in seen:
            continue

        score = _score_candidate_name(name)
        if score <= 0:
            continue

        matched = _match_candidate_by_name(name, candidates)
        group = concept.get("group") or DEFAULT_GROUP
        description = concept.get("description") or ""

        if matched:
            if not description:
                description = matched["description"]
            if group == DEFAULT_GROUP or _looks_like_noise_group(group):
                group = matched["group"]

        description = description or _build_description_from_pages(name, pages)
        description = description or f"{name}의 핵심 개념과 역할을 다루는 학습 단위이다."
        group = _normalize_group_name(group)

        validated.append({"name": name, "description": description, "group": group})
        seen.add(name)
        if len(validated) >= target_count:
            break

    if len(validated) < max(4, min(6, target_count)):
        heuristic = _select_concepts_heuristically(candidates, pages, lines, target_count)
        for concept in heuristic:
            if concept["name"] in seen:
                continue
            validated.append(concept)
            seen.add(concept["name"])
            if len(validated) >= target_count:
                break

    return validated[:MAX_CONCEPTS]


def _select_concepts_heuristically(
    candidates: list[dict], pages: list[str], lines: list[dict], target_count: int
) -> list[dict]:
    selected = []
    for item in candidates:
        name = item["name"]
        if _score_candidate_name(name) <= 0:
            continue
        if _is_too_similar_to_selected(name, selected):
            continue

        description = item["description"] or _build_description_from_context(item, lines)
        description = description or _build_description_from_pages(name, pages)
        description = description or f"{name}의 핵심 개념과 역할을 다루는 학습 단위이다."

        selected.append(
            {
                "name": name,
                "description": description,
                "group": _normalize_group_name(item["group"]),
            }
        )
        if len(selected) >= target_count:
            break

    return selected[:MAX_CONCEPTS]


def _build_relations(concepts: list[dict], lines: list[dict]) -> list[dict]:
    # 현재 초기 그래프에서는 part_of와 제한적인 prerequisite만 사용한다.
    # related_to는 의도적으로 제외한다.
    concept_names = {concept["name"] for concept in concepts}
    normalized_name_map = {_normalize_text_key(name): name for name in concept_names}
    relations: list[dict] = []
    seen: set[tuple[str, str, str]] = set()

    for concept in concepts:
        target = _resolve_group_to_concept(concept["group"], normalized_name_map)
        if target and target != concept["name"]:
            relation = (concept["name"], target, "part_of")
            if relation not in seen:
                seen.add(relation)
                relations.append({"source": concept["name"], "target": target, "relation_type": "part_of"})

    structure_relations = _build_structure_relations(concepts, lines, normalized_name_map)
    for relation in structure_relations:
        key = (relation["source"], relation["target"], relation["relation_type"])
        if key not in seen:
            seen.add(key)
            relations.append(relation)

    prerequisite_count = 0
    for concept in concepts:
        if prerequisite_count >= 2:
            break
        for candidate in concepts:
            if prerequisite_count >= 2:
                break
            if concept["name"] == candidate["name"]:
                continue
            if candidate["group"] != concept["name"]:
                continue
            if not _looks_like_prerequisite(concept["name"], candidate["name"]):
                continue

            relation = (concept["name"], candidate["name"], "prerequisite")
            if relation in seen:
                continue

            seen.add(relation)
            prerequisite_count += 1
            relations.append(
                {
                    "source": concept["name"],
                    "target": candidate["name"],
                    "relation_type": "prerequisite",
                }
            )

    return relations


def _build_structure_relations(concepts: list[dict], lines: list[dict], normalized_name_map: dict[str, str]) -> list[dict]:
    concept_names = {concept["name"] for concept in concepts}
    relations = []

    for record in lines:
        heading = record["heading"]
        if not heading:
            continue
        title = heading["title"]
        source = _resolve_group_to_concept(title, normalized_name_map)
        target = _resolve_group_to_concept(record["parent_group"], normalized_name_map)
        if source and target and source in concept_names and target in concept_names and source != target:
            relations.append({"source": source, "target": target, "relation_type": "part_of"})

    return relations


def _detect_heading(line: str) -> dict | None:
    raw = line.strip()
    title = _strip_heading_prefix(raw)
    if not _is_heading_like(raw, title):
        return None

    level = 2
    if re.match(r"^제\s*\d+\s*장", raw):
        level = 1
    elif re.match(r"^제\s*\d+\s*절", raw):
        level = 2
    else:
        number_match = re.match(r"^(\d+(?:\.\d+){0,2})", raw)
        if number_match:
            level = number_match.group(1).count(".") + 1
        elif re.match(r"^[A-Za-z가-힣]\)", raw):
            level = 3

    cleaned = _clean_candidate_name(title)
    if _score_candidate_name(cleaned) <= 0:
        return None

    return {"level": level, "title": cleaned}


def _is_heading_like(raw: str, title: str) -> bool:
    if not title or len(title) > 40:
        return False
    if title.lower() in GENERIC_TITLES:
        return False
    if raw.endswith((".", "!", "?", "다")) and len(raw) > 20:
        return False
    if re.match(r"^(제\s*\d+\s*[장절]|[0-9]+(?:\.[0-9]+){0,2}\s*[\.\)]?|[A-Za-z가-힣]\))", raw):
        return True
    return len(title) <= 20 and " " in raw and len(raw.split()) <= 4 and not any(ch in raw for ch in ":;")


def _estimate_target_concept_count(pages: list[str]) -> int:
    total_chars = sum(len(page) for page in pages)
    page_count = len(pages)

    if total_chars < 1500:
        base = 5
    elif total_chars < 4000:
        base = 7
    elif total_chars < 8000:
        base = 9
    else:
        base = 10

    adjusted = min(MAX_CONCEPTS, base + min(page_count // 4, 2))
    return max(4, adjusted)


def _build_description_from_pages(name: str, pages: list[str]) -> str:
    for page_text in pages:
        for sentence in _split_sentences(page_text):
            if name in sentence and len(sentence) >= len(name) + 8:
                return _clip_description(sentence)
    return ""


def _build_description_from_context(candidate: dict, lines: list[dict]) -> str:
    page_index = candidate["page_index"]
    line_index = candidate["line_index"]
    collected: list[str] = []

    for record in lines:
        if record["page_index"] != page_index:
            continue
        if record["line_index"] <= line_index:
            continue
        if record["heading"]:
            break
        text = record["line"]
        if len(text) < 8:
            continue
        collected.append(text)
        if len(" ".join(collected)) >= 90 or len(collected) >= 2:
            break

    return _clip_description(" ".join(collected)) if collected else ""


def _find_group_for_sentence(page_index: int, sentence: str, lines: list[dict]) -> str:
    first_token = _normalize_whitespace(sentence)[:20]
    for record in lines:
        if record["page_index"] != page_index:
            continue
        if first_token and first_token in record["line"]:
            return record["active_group"]
    for record in reversed(lines):
        if record["page_index"] == page_index:
            return record["active_group"]
    return DEFAULT_GROUP


def _extract_inline_terms(sentence: str) -> list[str]:
    results: list[str] = []
    for match in re.finditer(r"([A-Za-z가-힣][A-Za-z가-힣0-9\s]{1,18})(?:의|을|를)\s", sentence):
        term = _clean_candidate_name(match.group(1))
        if _score_candidate_name(term) > 0:
            results.append(term)
    return results[:2]


def _split_sentences(text: str) -> list[str]:
    sentences = []
    for block in text.splitlines():
        for chunk in re.split(r"(?<=[.!?])\s+|(?<=다\.)\s+", block):
            cleaned = _normalize_whitespace(chunk)
            if len(cleaned) >= 8:
                sentences.append(cleaned)
    return sentences


def _normalize_whitespace(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def _strip_heading_prefix(text: str) -> str:
    return HEADING_PREFIX_RE.sub("", text).strip(" -:[]()")


def _clean_candidate_name(name: str) -> str:
    cleaned = HEADING_PREFIX_RE.sub("", name)
    cleaned = cleaned.strip(" \"'`[](){}<>-:;,.")
    cleaned = _normalize_whitespace(cleaned)
    return cleaned


def _normalize_group_name(group: str) -> str:
    cleaned = _clean_candidate_name(group or "")
    if not cleaned or _looks_like_noise_group(cleaned):
        return DEFAULT_GROUP
    return cleaned


def _looks_like_noise_group(group: str) -> bool:
    lowered = group.lower()
    return lowered in GENERIC_TITLES or _score_candidate_name(group) <= 0


def _score_candidate_name(name: str) -> int:
    # 후보 정렬/필터링을 위한 내부 휴리스틱 점수다.
    # 사용자 이해도 score와는 무관하며 DB에 저장되지 않는다.
    if not name:
        return -10

    cleaned = _clean_candidate_name(name)
    if len(cleaned) < 2 or len(cleaned) > 30:
        return -10

    score = 0
    words = cleaned.split()

    if bool(re.search(r"[A-Za-z가-힣]", cleaned)):
        score += 2
    else:
        score -= 5

    if cleaned.lower() in GENERIC_TITLES:
        score -= 6
    if cleaned.lower() in STOPWORDS:
        score -= 6

    if len(words) == 1:
        score += 3
    elif len(words) == 2:
        score += 2
    elif len(words) == 3:
        score += 1
    else:
        score -= 3

    if re.fullmatch(r"[0-9.\-]+", cleaned):
        score -= 6
    if "/" in cleaned or "\\" in cleaned or ":" in cleaned:
        score -= 3
    if re.search(r"(이다|한다|하고|하며|에서|으로|까지)$", cleaned):
        score -= 4
    if any(part in cleaned for part in BAD_NAME_PARTS):
        score -= 3
    if any(token.lower() in STOPWORDS for token in words):
        score -= 2

    return score


def _clip_description(text: str, limit: int = 120) -> str:
    cleaned = _normalize_whitespace(text)
    if len(cleaned) <= limit:
        return cleaned
    return cleaned[: limit - 1].rstrip() + "…"


def _is_too_similar_to_selected(name: str, selected: list[dict]) -> bool:
    normalized = _normalize_text_key(name)
    for item in selected:
        other = _normalize_text_key(item["name"])
        if normalized == other:
            return True
        if len(normalized) >= 2 and len(other) >= 2 and (normalized in other or other in normalized):
            return True
    return False


def _looks_like_prerequisite(source: str, target: str) -> bool:
    if source == target:
        return False
    if len(source) < 2 or len(target) < 3:
        return False
    return _normalize_text_key(source) in _normalize_text_key(target)


def _resolve_group_to_concept(group: str, normalized_name_map: dict[str, str]) -> str | None:
    normalized_group = _normalize_text_key(group)
    if not normalized_group:
        return None
    if normalized_group in normalized_name_map:
        return normalized_name_map[normalized_group]

    for normalized_name, original_name in normalized_name_map.items():
        if normalized_name and (normalized_name in normalized_group or normalized_group in normalized_name):
            return original_name
    return None


def _match_candidate_by_name(name: str, candidates: list[dict]) -> dict | None:
    normalized = _normalize_text_key(name)
    for candidate in candidates:
        if _normalize_text_key(candidate["name"]) == normalized:
            return candidate
    for candidate in candidates:
        other = _normalize_text_key(candidate["name"])
        if normalized and other and (normalized in other or other in normalized):
            return candidate
    return None


def _normalize_text_key(text: str) -> str:
    return re.sub(r"[^A-Za-z가-힣0-9]", "", text).lower()


def _fallback_graph() -> dict:
    return {
        "concepts": [
            {
                "name": "함수",
                "description": "입력값을 받아 출력값을 대응시키는 기본 개념이다.",
                "group": "수학 기초",
            },
            {
                "name": "일차함수",
                "description": "그래프가 직선으로 표현되는 함수 단원이다.",
                "group": "함수",
            },
            {
                "name": "기울기",
                "description": "직선의 변화 정도를 나타내는 핵심 요소이다.",
                "group": "일차함수",
            },
            {
                "name": "절편",
                "description": "직선이 축과 만나는 위치를 설명하는 개념이다.",
                "group": "일차함수",
            },
        ],
        "relations": [
            {"source": "일차함수", "target": "함수", "relation_type": "part_of"},
            {"source": "기울기", "target": "일차함수", "relation_type": "part_of"},
            {"source": "절편", "target": "일차함수", "relation_type": "part_of"},
            {"source": "함수", "target": "일차함수", "relation_type": "prerequisite"},
        ],
    }
