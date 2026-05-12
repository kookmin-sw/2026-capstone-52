import json
import logging
import re
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any

from app.ai.llm_client import LLMClientError, call_llm_json


# 개념 정규화 모듈
#
# 역할:
# - 과목별 alias dictionary를 읽어 raw concept name을 stable concept_id로 정규화한다.
# - exact/normalized match를 우선 적용하고, 필요한 경우에만 fuzzy/LLM 보조 판정을 사용한다.
# - alias dictionary가 없거나 잘못된 경우만 예외를 발생시키고, 애매한 매칭 실패는
#   서비스 중단이 아닌 unmatched/needs_review 결과로 반환한다.
logger = logging.getLogger(__name__)

SUPPORTED_SUBJECT_IDS = {
    "operating_system",
    "data_structure",
    "computer_network",
    "algorithm",
}

ALIASES_DIR = Path(__file__).resolve().parent.parent / "data" / "aliases"

STRONG_FUZZY_THRESHOLD = 0.88
AMBIGUOUS_FUZZY_THRESHOLD = 0.55


class ConceptNormalizerError(Exception):
    """Base exception for concept normalization failures."""


class AliasDictionaryNotFoundError(ConceptNormalizerError):
    """Raised when the subject alias dictionary file does not exist."""


class AliasDictionaryInvalidError(ConceptNormalizerError):
    """Raised when the subject alias dictionary file is malformed."""


# 텍스트 정규화 함수
#
# 역할:
# - alias match 전에 문자열 비교 기준을 통일한다.
# - 영어는 lowercase 처리하고, 공백/하이픈/언더스코어/기본 구두점을 제거한다.
# - 한글은 유지해서 "교착 상태" -> "교착상태"처럼 자연스럽게 비교할 수 있게 한다.
def normalize_text(text: str) -> str:
    if not isinstance(text, str):
        return ""

    normalized = text.strip().lower()
    normalized = re.sub(r"[\s\-_]+", "", normalized)
    normalized = re.sub(r"[^\w가-힣]", "", normalized)
    return normalized


# 과목별 alias dictionary 로드 함수
#
# 역할:
# - 지원하는 subject_id만 허용하고 대응되는 JSON 파일을 읽는다.
# - 파일 누락, JSON 파싱 실패, 기본 스키마 오류를 명시적 예외로 구분한다.
def load_alias_dictionary(subject_id: str) -> dict[str, Any]:
    if subject_id not in SUPPORTED_SUBJECT_IDS:
        raise AliasDictionaryInvalidError(f"Unsupported subject_id: {subject_id}")

    file_path = ALIASES_DIR / f"{subject_id}_aliases.json"
    if not file_path.exists():
        raise AliasDictionaryNotFoundError(
            f"Alias dictionary file not found for subject_id='{subject_id}': {file_path}"
        )

    try:
        with file_path.open("r", encoding="utf-8") as file:
            data = json.load(file)
    except json.JSONDecodeError as error:
        raise AliasDictionaryInvalidError(
            f"Alias dictionary JSON is invalid for subject_id='{subject_id}': {error}"
        ) from error

    _validate_alias_dictionary(data, subject_id=subject_id, file_path=file_path)
    return data


# alias lookup 생성 함수
#
# 역할:
# - canonical_name, korean_name, aliases를 모두 normalize해서 빠른 lookup map으로 만든다.
# - normalized alias 하나가 concept 하나를 가리키도록 구성한다.
def build_alias_lookup(alias_data: dict[str, Any]) -> dict[str, dict[str, Any]]:
    concepts = alias_data.get("concepts", [])
    lookup: dict[str, dict[str, Any]] = {}

    for concept in concepts:
        alias_values = _collect_alias_values(concept)
        for alias in alias_values:
            normalized_alias = normalize_text(alias)
            if normalized_alias:
                lookup[normalized_alias] = concept

    return lookup


# exact/normalized alias match 함수
#
# 역할:
# - raw concept name을 normalize한 뒤 lookup에서 즉시 대응되는 concept를 찾는다.
# - exact/normalized alias match는 가장 강한 match로 간주한다.
def match_alias(raw_name: str, alias_lookup: dict[str, dict[str, Any]]) -> dict[str, Any] | None:
    normalized_key = normalize_text(raw_name)
    if not normalized_key:
        return None
    return alias_lookup.get(normalized_key)


# fuzzy 후보 검색 함수
#
# 역할:
# - exact match에 실패한 경우 concept 후보를 표준 라이브러리 기반 유사도로 정렬한다.
# - 각 concept의 canonical_name, korean_name, aliases를 모두 비교해 최고 점수를 대표 점수로 사용한다.
def find_fuzzy_candidates(
    raw_name: str,
    concepts: list[dict[str, Any]],
    top_k: int = 5,
) -> list[dict[str, Any]]:
    normalized_key = normalize_text(raw_name)
    if not normalized_key:
        return []

    scored_candidates: list[dict[str, Any]] = []
    for concept in concepts:
        best_score = 0.0
        for alias in _collect_alias_values(concept):
            alias_key = normalize_text(alias)
            if not alias_key:
                continue
            score = SequenceMatcher(None, normalized_key, alias_key).ratio()
            if score > best_score:
                best_score = score

        scored_candidates.append(
            {
                "concept_id": concept["concept_id"],
                "canonical_name": concept["canonical_name"],
                "korean_name": concept["korean_name"],
                "group": concept["group"],
                "score": round(best_score, 4),
            }
        )

    scored_candidates.sort(key=lambda item: item["score"], reverse=True)
    return scored_candidates[: max(top_k, 1)]


# 메인 정규화 함수
#
# 역할:
# - service-time normalization 전체 흐름의 단일 진입점이다.
# - alias exact match -> fuzzy auto match -> ambiguous LLM assist -> unmatched 순서로 처리한다.
# - 애매한 경우에도 fake concept_id를 만들지 않고 needs_review 결과를 반환한다.
def normalize_concept(
    raw_name: str,
    subject_id: str,
    *,
    context: str | None = None,
    use_llm: bool = True,
    top_k: int = 5,
) -> dict[str, Any]:
    alias_data = load_alias_dictionary(subject_id)
    alias_lookup = build_alias_lookup(alias_data)
    normalized_key = normalize_text(raw_name)

    matched_concept = match_alias(raw_name, alias_lookup)
    if matched_concept:
        return _build_matched_result(
            raw_name=raw_name,
            normalized_key=normalized_key,
            concept=matched_concept,
            matched_by="alias",
            confidence=1.0,
            candidates=[],
            needs_review=False,
            reason="Matched by exact or normalized alias lookup.",
        )

    concepts = alias_data.get("concepts", [])
    candidates = find_fuzzy_candidates(raw_name, concepts, top_k=top_k)
    if not candidates:
        return _build_unmatched_result(
            raw_name=raw_name,
            normalized_key=normalized_key,
            candidates=[],
            reason="No candidates found in alias dictionary.",
        )

    best_candidate = candidates[0]
    if best_candidate["score"] >= STRONG_FUZZY_THRESHOLD:
        concept = _find_concept_by_id(concepts, best_candidate["concept_id"])
        if concept is not None:
            return _build_matched_result(
                raw_name=raw_name,
                normalized_key=normalized_key,
                concept=concept,
                matched_by="fuzzy",
                confidence=best_candidate["score"],
                candidates=candidates,
                needs_review=False,
                reason="Matched by strong fuzzy similarity.",
            )

    if use_llm and _is_ambiguous_candidate_range(candidates):
        llm_result = _resolve_with_llm(
            raw_name=raw_name,
            subject_id=subject_id,
            context=context,
            candidates=candidates,
        )
        if llm_result is not None:
            selected_concept = _find_concept_by_id(concepts, llm_result["concept_id"])
            if selected_concept is not None:
                return _build_matched_result(
                    raw_name=raw_name,
                    normalized_key=normalized_key,
                    concept=selected_concept,
                    matched_by="llm",
                    confidence=llm_result["confidence"],
                    candidates=candidates,
                    needs_review=False,
                    reason=llm_result["reason"],
                )

    if best_candidate["score"] >= AMBIGUOUS_FUZZY_THRESHOLD:
        reason = "Fuzzy candidates were ambiguous and no confident automatic match was available."
    else:
        reason = "Similarity was too weak to accept a concept match automatically."

    return _build_unmatched_result(
        raw_name=raw_name,
        normalized_key=normalized_key,
        candidates=candidates,
        reason=reason,
    )


# alias dictionary 검증 함수
#
# 역할:
# - 최소 필드와 자료형이 올바른지 확인한다.
# - 잘못된 JSON 구조가 런타임 매칭 로직에 스며들지 않게 초기에 차단한다.
def _validate_alias_dictionary(
    alias_data: dict[str, Any],
    *,
    subject_id: str,
    file_path: Path,
) -> None:
    if not isinstance(alias_data, dict):
        raise AliasDictionaryInvalidError(f"Alias dictionary must be an object: {file_path}")

    if alias_data.get("subject_id") != subject_id:
        raise AliasDictionaryInvalidError(
            f"Alias dictionary subject_id mismatch: expected '{subject_id}', got '{alias_data.get('subject_id')}'"
        )

    concepts = alias_data.get("concepts")
    if not isinstance(concepts, list) or not concepts:
        raise AliasDictionaryInvalidError(
            f"Alias dictionary concepts must be a non-empty list: {file_path}"
        )

    required_fields = {
        "concept_id",
        "canonical_name",
        "korean_name",
        "aliases",
        "group",
        "description",
        "importance",
        "concept_difficulty",
    }
    for index, concept in enumerate(concepts):
        if not isinstance(concept, dict):
            raise AliasDictionaryInvalidError(
                f"Concept entry at index {index} must be an object: {file_path}"
            )
        missing_fields = required_fields - concept.keys()
        if missing_fields:
            raise AliasDictionaryInvalidError(
                f"Concept entry '{concept.get('concept_id', index)}' is missing fields: {sorted(missing_fields)}"
            )
        if not isinstance(concept.get("aliases"), list):
            raise AliasDictionaryInvalidError(
                f"Concept entry '{concept.get('concept_id', index)}' aliases must be a list."
            )


# concept alias value 수집 함수
#
# 역할:
# - fuzzy/exact match에서 비교할 문자열 목록을 한곳에서 통일한다.
# - canonical_name, korean_name, aliases를 모두 비교 후보에 포함한다.
def _collect_alias_values(concept: dict[str, Any]) -> list[str]:
    values: list[str] = []
    for key in ("canonical_name", "korean_name"):
        value = concept.get(key)
        if isinstance(value, str) and value.strip():
            values.append(value)

    aliases = concept.get("aliases", [])
    if isinstance(aliases, list):
        for alias in aliases:
            if isinstance(alias, str) and alias.strip():
                values.append(alias)

    return values


# matched 결과 생성 함수
#
# 역할:
# - 외부에 노출할 normalization result shape를 일관되게 맞춘다.
def _build_matched_result(
    *,
    raw_name: str,
    normalized_key: str,
    concept: dict[str, Any],
    matched_by: str,
    confidence: float,
    candidates: list[dict[str, Any]],
    needs_review: bool,
    reason: str,
) -> dict[str, Any]:
    return {
        "raw_name": raw_name,
        "normalized_key": normalized_key,
        "matched": True,
        "concept_id": concept["concept_id"],
        "canonical_name": concept["canonical_name"],
        "korean_name": concept["korean_name"],
        "group": concept["group"],
        "description": concept["description"],
        "matched_by": matched_by,
        "confidence": round(float(confidence), 4),
        "candidates": candidates,
        "needs_review": needs_review,
        "reason": reason,
    }


# unmatched 결과 생성 함수
#
# 역할:
# - 애매하거나 실패한 매칭을 명시적 결과로 반환한다.
# - 후속 workflow가 DB 없이도 needs_review 플래그를 해석할 수 있게 한다.
def _build_unmatched_result(
    *,
    raw_name: str,
    normalized_key: str,
    candidates: list[dict[str, Any]],
    reason: str,
) -> dict[str, Any]:
    return {
        "raw_name": raw_name,
        "normalized_key": normalized_key,
        "matched": False,
        "concept_id": None,
        "canonical_name": None,
        "korean_name": None,
        "group": None,
        "description": None,
        "matched_by": "unmatched",
        "confidence": 0.0,
        "candidates": candidates,
        "needs_review": True,
        "reason": reason,
    }


# concept_id 기반 concept 탐색 함수
#
# 역할:
# - LLM/fuzzy 결과의 concept_id를 실제 dictionary concept 원본으로 다시 연결한다.
def _find_concept_by_id(
    concepts: list[dict[str, Any]],
    concept_id: str,
) -> dict[str, Any] | None:
    for concept in concepts:
        if concept.get("concept_id") == concept_id:
            return concept
    return None


# ambiguous 후보 범위 판단 함수
#
# 역할:
# - fuzzy 후보가 애매해서 LLM 보조 판단이 의미 있는 상황인지 결정한다.
def _is_ambiguous_candidate_range(candidates: list[dict[str, Any]]) -> bool:
    if not candidates:
        return False

    best_score = candidates[0]["score"]
    if best_score < AMBIGUOUS_FUZZY_THRESHOLD or best_score >= STRONG_FUZZY_THRESHOLD:
        return False

    if len(candidates) == 1:
        return True

    second_score = candidates[1]["score"]
    return second_score >= AMBIGUOUS_FUZZY_THRESHOLD * 0.9 or (best_score - second_score) <= 0.15


# LLM 보조 매칭 함수
#
# 역할:
# - 전체 alias dictionary가 아니라 top-k 후보만 LLM에 전달한다.
# - candidate concept_id 중 하나만 선택하게 강제하고, 실패하면 None을 반환한다.
# - ambiguous normalization 실패는 서비스 중단이 아니라 unmatched 처리로 이어진다.
def _resolve_with_llm(
    *,
    raw_name: str,
    subject_id: str,
    context: str | None,
    candidates: list[dict[str, Any]],
) -> dict[str, Any] | None:
    system_prompt = (
        "You are a concept normalization assistant. "
        "Choose only from the provided candidate concept_ids. "
        "Do not invent a new concept_id. "
        "Return JSON only with fields: matched, concept_id, confidence, reason."
    )
    user_prompt = json.dumps(
        {
            "subject_id": subject_id,
            "raw_name": raw_name,
            "context": context,
            "candidates": candidates,
            "instruction": (
                "If one candidate clearly matches the raw_name, return matched=true with that concept_id. "
                "If none is reliable, return matched=false with concept_id=null."
            ),
        },
        ensure_ascii=False,
    )

    try:
        result = call_llm_json(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            task_name="concept_normalizer",
            temperature=0.0,
        )
    except LLMClientError as error:
        logger.warning(
            "concept_normalizer_llm_failed subject_id=%s raw_name=%s error=%s",
            subject_id,
            raw_name,
            str(error),
        )
        return None

    if not isinstance(result, dict):
        return None

    matched = result.get("matched")
    concept_id = result.get("concept_id")
    confidence = result.get("confidence")
    reason = result.get("reason", "LLM result was accepted.")

    allowed_concept_ids = {candidate["concept_id"] for candidate in candidates}
    if matched is not True:
        return None
    if concept_id not in allowed_concept_ids:
        return None
    if not isinstance(confidence, (int, float)) or confidence < 0.65:
        return None

    return {
        "concept_id": concept_id,
        "confidence": round(float(confidence), 4),
        "reason": reason,
    }
