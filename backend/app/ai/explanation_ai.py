import json
import logging
from typing import Any

from app.ai.llm_client import LLMClientError, call_llm_json


# 설명 AI / 헬퍼 모듈
#
# 역할:
# - 특정 concept에 대한 개인화된 설명을 LLM으로 생성한다.
# - diagnosis 결과, prerequisite 개념, graph context를 prompt에 반영한다.
# - DB, route, service, S3에 의존하지 않는 standalone helper로 동작한다.
# - teacher/service layer가 재사용하기 쉬운 구조화된 explanation payload만 반환한다.
logger = logging.getLogger(__name__)

SUPPORTED_EXPLANATION_STYLES = {"example", "concise", "step"}


class ExplanationAIError(Exception):
    """Base exception for explanation AI failures."""


class ExplanationGenerationError(ExplanationAIError):
    """Raised when LLM-based explanation generation fails."""


class ExplanationValidationError(ExplanationAIError):
    """Raised when explanation input or output payload is invalid."""


# 설명 생성 공개 함수
#
# 역할:
# - target concept와 사용자 상태를 바탕으로 맞춤 설명을 생성한다.
# - explanation level은 user_state를 기준으로 Python 쪽에서 먼저 결정한다.
# - LLM은 JSON explanation payload를 생성하고, Python 쪽에서 필수 필드와 기본값을 보정한다.
def generate_explanation(
    target_concept: dict,
    *,
    user_state: dict | None = None,
    prerequisite_concepts: list[dict] | None = None,
    recent_diagnosis: list[dict] | None = None,
    graph_context: dict | None = None,
    backbone_context: str | None = None,
    explanation_style: str = "step",
) -> dict[str, Any]:
    validated_target = _validate_target_concept(target_concept)
    user_level = _normalize_user_level(user_state)
    explanation_level = _explanation_level_from_user_level(user_level)

    if explanation_style not in SUPPORTED_EXPLANATION_STYLES:
        raise ExplanationValidationError(f"Unsupported explanation_style: {explanation_style}")

    compact_context = _compact_context(
        target_concept=validated_target,
        user_state=user_state,
        prerequisite_concepts=prerequisite_concepts,
        recent_diagnosis=recent_diagnosis,
        graph_context=graph_context,
        backbone_context=backbone_context,
        explanation_style=explanation_style,
        user_level=user_level,
        explanation_level=explanation_level,
    )

    system_prompt = (
        "You are a personalized CS tutor for a learning support system. "
        "Generate an explanation for one target concept only. "
        "Adjust difficulty to the user's understanding level. "
        "Interpret explanation_style as follows: "
        "'example' means example and analogy centered explanation, "
        "'concise' means short and key-point centered explanation, "
        "'step' means step-by-step explanation. "
        "If prerequisite concepts are weak, explain why they matter and include prerequisite review. "
        "If recent diagnosis weak points exist, address them naturally without exposing internal tag names. "
        "If backbone context is provided, use it as supporting reference only. "
        "Do not claim knowledge beyond the provided context. "
        "Do not update scores or user state. "
        "Return JSON only."
    )
    user_prompt = json.dumps(
        {
            "context": compact_context,
            "explanation_style": explanation_style,
            "user_level": user_level,
            "explanation_level": explanation_level,
            "output_schema": {
                "concept_id": validated_target["concept_id"],
                "concept_name": validated_target["concept_name"],
                "user_level": user_level,
                "explanation_level": explanation_level,
                "title": "string",
                "summary": "string",
                "explanation": "string",
                "prerequisite_review": [
                    {
                        "concept_id": "string",
                        "concept_name": "string",
                        "reason": "string",
                        "review_text": "string",
                    }
                ],
                "common_misconceptions": [
                    {
                        "misconception": "string",
                        "correction": "string",
                    }
                ],
                "example": "string",
                "connection_to_graph": "string",
                "next_steps": ["string"],
                "confidence_note": "string",
            },
        },
        ensure_ascii=False,
    )

    try:
        payload = call_llm_json(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            task_name="explanation_ai_generate_explanation",
            temperature=0.3,
            max_tokens=2500,
        )
    except LLMClientError as error:
        raise ExplanationGenerationError(f"Explanation generation failed: {error}") from error

    explanation_payload = _sanitize_explanation_payload(
        payload,
        validated_target,
        user_level,
        explanation_level,
    )
    logger.info(
        "explanation_generated concept_id=%s user_level=%s explanation_level=%s style=%s",
        explanation_payload["concept_id"],
        user_level,
        explanation_level,
        explanation_style,
    )
    return explanation_payload


# 사용자 수준 정규화 내부 함수
#
# 역할:
# - user_state에서 understanding_level을 읽고 1~5 범위로 보정한다.
# - 값이 없거나 비정상이면 중립값 3을 사용한다.
def _normalize_user_level(user_state: dict | None) -> int:
    if not isinstance(user_state, dict):
        return 3

    raw_level = user_state.get("understanding_level")
    if raw_level is None:
        score = user_state.get("understanding_score")
        if isinstance(score, (int, float)):
            return _score_to_level(float(score))
        return 3

    try:
        level = int(raw_level)
    except (TypeError, ValueError):
        return 3
    return max(1, min(level, 5))


# 설명 난이도 레이블 내부 함수
#
# 역할:
# - 수치형 user level을 설명 프롬프트용 난이도 레이블로 바꾼다.
def _explanation_level_from_user_level(level: int) -> str:
    if level <= 2:
        return "beginner"
    if level == 3:
        return "intermediate"
    return "advanced"


# 설명 payload 보정 내부 함수
#
# 역할:
# - LLM 결과에서 필수 필드를 강제하고 누락 필드는 안전한 기본값으로 채운다.
# - frontend/service가 바로 쓰기 쉬운 구조를 보장한다.
def _sanitize_explanation_payload(
    payload: dict,
    target_concept: dict,
    user_level: int,
    explanation_level: str,
) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise ExplanationValidationError("Explanation payload must be a dict.")

    concept_id = str(payload.get("concept_id") or target_concept["concept_id"]).strip()
    concept_name = str(payload.get("concept_name") or target_concept["concept_name"]).strip()
    title = _coerce_non_empty_string(payload.get("title")) or f"{concept_name} 이해하기"
    summary = _coerce_non_empty_string(payload.get("summary")) or (
        f"{concept_name}의 핵심을 사용자 수준에 맞게 정리한 설명입니다."
    )
    explanation = _coerce_non_empty_string(payload.get("explanation")) or summary

    sanitized = {
        "concept_id": concept_id,
        "concept_name": concept_name,
        "user_level": user_level,
        "explanation_level": _coerce_non_empty_string(payload.get("explanation_level")) or explanation_level,
        "title": title,
        "summary": summary,
        "explanation": explanation,
        "prerequisite_review": _sanitize_prerequisite_review(payload.get("prerequisite_review")),
        "common_misconceptions": _sanitize_common_misconceptions(payload.get("common_misconceptions")),
        "example": _coerce_non_empty_string(payload.get("example")) or "",
        "connection_to_graph": _coerce_non_empty_string(payload.get("connection_to_graph")) or "",
        "next_steps": _sanitize_string_list(payload.get("next_steps")) or ["핵심 정의와 예시를 다시 확인해 보세요."],
        "confidence_note": _coerce_non_empty_string(payload.get("confidence_note")) or "",
    }

    required_fields = [
        "concept_id",
        "concept_name",
        "user_level",
        "explanation_level",
        "title",
        "summary",
        "explanation",
        "next_steps",
    ]
    for field_name in required_fields:
        value = sanitized.get(field_name)
        if value in (None, "", []):
            raise ExplanationValidationError(f"Sanitized explanation payload missing required field: {field_name}")

    return sanitized


# context 압축 내부 함수
#
# 역할:
# - LLM prompt에 필요한 핵심 정보만 남기고 context를 compact하게 정리한다.
# - 불필요한 대형 payload를 줄여 prompt 안정성을 높인다.
def _compact_context(
    *,
    target_concept: dict,
    user_state: dict | None,
    prerequisite_concepts: list[dict] | None,
    recent_diagnosis: list[dict] | None,
    graph_context: dict | None,
    backbone_context: str | None,
    explanation_style: str,
    user_level: int,
    explanation_level: str,
) -> dict[str, Any]:
    return {
        "target_concept": target_concept,
        "user_state": user_state or {},
        "prerequisite_concepts": [
            {
                "concept_id": item.get("concept_id"),
                "concept_name": item.get("concept_name") or item.get("name"),
                "understanding_score": item.get("understanding_score"),
                "understanding_level": item.get("understanding_level"),
                "relation_type": item.get("relation_type"),
            }
            for item in (prerequisite_concepts or [])
            if isinstance(item, dict)
        ],
        "recent_diagnosis": [
            {
                "question_id": item.get("question_id"),
                "answer_score": item.get("answer_score"),
                "missed_correct_option_ids": item.get("missed_correct_option_ids"),
                "wrong_selected_option_ids": item.get("wrong_selected_option_ids"),
                "feedback_tags": item.get("feedback_tags"),
            }
            for item in (recent_diagnosis or [])
            if isinstance(item, dict)
        ],
        "graph_context": graph_context or {},
        "backbone_context": backbone_context or "",
        "explanation_style": explanation_style,
        "user_level": user_level,
        "explanation_level": explanation_level,
    }


def _validate_target_concept(target_concept: dict) -> dict[str, Any]:
    if not isinstance(target_concept, dict):
        raise ExplanationValidationError("target_concept must be a dict.")

    concept_id = _coerce_non_empty_string(target_concept.get("concept_id"))
    concept_name = _coerce_non_empty_string(
        target_concept.get("concept_name")
        or target_concept.get("name")
        or target_concept.get("korean_name")
    )

    if not concept_id and not concept_name:
        raise ExplanationValidationError("target_concept must contain concept_id or concept_name.")

    return {
        "concept_id": concept_id or concept_name,
        "concept_name": concept_name or concept_id,
        "korean_name": _coerce_non_empty_string(target_concept.get("korean_name")) or "",
        "description": _coerce_non_empty_string(target_concept.get("description")) or "",
        "group": _coerce_non_empty_string(target_concept.get("group")) or "",
    }


def _sanitize_prerequisite_review(value: Any) -> list[dict[str, str]]:
    if not isinstance(value, list):
        return []

    sanitized: list[dict[str, str]] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        concept_id = _coerce_non_empty_string(item.get("concept_id")) or ""
        concept_name = _coerce_non_empty_string(item.get("concept_name")) or ""
        reason = _coerce_non_empty_string(item.get("reason")) or ""
        review_text = _coerce_non_empty_string(item.get("review_text")) or ""
        if concept_id or concept_name or reason or review_text:
            sanitized.append(
                {
                    "concept_id": concept_id,
                    "concept_name": concept_name,
                    "reason": reason,
                    "review_text": review_text,
                }
            )
    return sanitized


def _sanitize_common_misconceptions(value: Any) -> list[dict[str, str]]:
    if not isinstance(value, list):
        return []

    sanitized: list[dict[str, str]] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        misconception = _coerce_non_empty_string(item.get("misconception")) or ""
        correction = _coerce_non_empty_string(item.get("correction")) or ""
        if misconception or correction:
            sanitized.append(
                {
                    "misconception": misconception,
                    "correction": correction,
                }
            )
    return sanitized


def _sanitize_string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [text for text in (_coerce_non_empty_string(item) for item in value) if text]


def _coerce_non_empty_string(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    stripped = value.strip()
    return stripped or None


def _score_to_level(score: float) -> int:
    if score < 0.2:
        return 1
    if score < 0.4:
        return 2
    if score < 0.6:
        return 3
    if score < 0.8:
        return 4
    return 5
