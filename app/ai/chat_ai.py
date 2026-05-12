import json
import logging
from typing import Any

from app.ai.llm_client import LLMClientError, call_llm_json


# 채팅 AI / 헬퍼 모듈
#
# 역할:
# - 한 번의 자유 학습 대화 턴을 처리한다.
# - 학습용 답변, 언급 개념, 약한 이해도 signal 후보를 구조화해 반환한다.
# - DB, route, service, S3에 의존하지 않는 standalone helper로 동작한다.
# - score_delta는 제안만 반환하며 실제 graph 업데이트는 절대 수행하지 않는다.
logger = logging.getLogger(__name__)

SUPPORTED_CHAT_MODES = {"learning_assistant", "concept_focus", "review", "qa"}
SUPPORTED_SIGNALS = {"positive", "confusion", "misconception", "neutral"}


class ChatAIError(Exception):
    """Base exception for chat AI failures."""


class ChatGenerationError(ChatAIError):
    """Raised when LLM-based chat generation fails."""


class ChatValidationError(ChatAIError):
    """Raised when chat input or output payload is invalid."""


# 채팅 처리 공개 함수
#
# 역할:
# - 사용자 메시지와 학습 context를 바탕으로 답변과 graph update candidate signal을 생성한다.
# - LLM은 reply와 signal 초안을 만들고, Python 쪽에서 actionable signal을 엄격히 정리한다.
# - allowed_concepts 바깥의 개념은 mention은 허용하되 update signal 대상에서는 제외한다.
def process_chat(
    message: str,
    *,
    target_concept: dict | None = None,
    graph_context: dict | None = None,
    user_state: dict | None = None,
    recent_diagnosis: list[dict] | None = None,
    conversation_context: list[dict] | None = None,
    allowed_concepts: list[dict] | None = None,
    chat_mode: str = "learning_assistant",
) -> dict[str, Any]:
    validated_message = _validate_message(message)
    if chat_mode not in SUPPORTED_CHAT_MODES:
        raise ChatValidationError(f"Unsupported chat_mode: {chat_mode}")

    compact_context = _compact_chat_context(
        message=validated_message,
        target_concept=target_concept,
        graph_context=graph_context,
        user_state=user_state,
        recent_diagnosis=recent_diagnosis,
        conversation_context=conversation_context,
        allowed_concepts=allowed_concepts,
        chat_mode=chat_mode,
    )

    system_prompt = (
        "You are a personalized CS learning assistant. "
        "Answer the learner's message using only the provided graph and user context. "
        "If context is insufficient, say what is missing. "
        "Do not invent graph nodes. "
        "Only create actionable graph update signals for allowed_concepts. "
        "Understanding signals must be conservative. "
        "score_delta must be between -0.05 and +0.05. "
        "Do not claim that any DB update or score update was applied. "
        "Do not expose internal metadata names to the learner. "
        "Return JSON only."
    )
    user_prompt = json.dumps(
        {
            "context": compact_context,
            "output_schema": {
                "reply": "string",
                "mentioned_concepts": [
                    {
                        "concept_id": "string",
                        "concept_name": "string",
                        "node_id": "string",
                        "match_reason": "string",
                    }
                ],
                "understanding_signals": [
                    {
                        "concept_id": "string",
                        "node_id": "string",
                        "signal": "positive",
                        "score_delta": 0.03,
                        "confidence": 0.6,
                        "reason": "string",
                    }
                ],
                "needs_graph_update": True,
                "suggested_next_actions": ["ask_followup_question"],
                "followup_question": "string",
                "safety_note": "string",
            },
        },
        ensure_ascii=False,
    )

    try:
        payload = call_llm_json(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            task_name="chat_ai_process_chat",
            temperature=0.3,
            max_tokens=2200,
        )
    except LLMClientError as error:
        raise ChatGenerationError(f"Chat generation failed: {error}") from error

    result = _sanitize_chat_payload(payload, allowed_concepts)
    logger.info(
        "chat_processed chat_mode=%s mentions=%d actionable_signals=%d",
        chat_mode,
        len(result["mentioned_concepts"]),
        len(result["understanding_signals"]),
    )
    return result


# 메시지 검증 내부 함수
#
# 역할:
# - 빈 문자열이나 비문자열 입력을 early reject한다.
def _validate_message(message: str) -> str:
    if not isinstance(message, str):
        raise ChatValidationError("message must be a string.")
    stripped = message.strip()
    if not stripped:
        raise ChatValidationError("message must be a non-empty string.")
    return stripped


# 채팅 context 압축 내부 함수
#
# 역할:
# - LLM prompt에 필요한 정보만 compact하게 묶는다.
# - service가 큰 graph를 넘기더라도 chat AI가 이해하기 쉬운 구조로 줄인다.
def _compact_chat_context(
    *,
    message: str,
    target_concept: dict | None,
    graph_context: dict | None,
    user_state: dict | None,
    recent_diagnosis: list[dict] | None,
    conversation_context: list[dict] | None,
    allowed_concepts: list[dict] | None,
    chat_mode: str,
) -> dict[str, Any]:
    return {
        "message": message,
        "chat_mode": chat_mode,
        "target_concept": _compact_target_concept(target_concept),
        "graph_context": _compact_graph_context(graph_context),
        "user_state": user_state if isinstance(user_state, dict) else {},
        "recent_diagnosis": _compact_recent_diagnosis(recent_diagnosis),
        "conversation_context": _compact_conversation_context(conversation_context),
        "allowed_concepts": _compact_allowed_concepts(allowed_concepts),
    }


# 채팅 payload 보정 내부 함수
#
# 역할:
# - LLM 결과에서 필수 구조를 강제하고 허용되지 않은 graph update signal을 제거한다.
# - needs_graph_update는 sanitization 이후 actionable signal 기준으로 다시 계산한다.
def _sanitize_chat_payload(
    payload: dict,
    allowed_concepts: list[dict] | None,
) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise ChatValidationError("Chat payload must be a dict.")

    reply = _coerce_non_empty_string(payload.get("reply"))
    if not reply:
        raise ChatValidationError("reply must be a non-empty string.")

    mentioned_concepts = _sanitize_mentioned_concepts(
        payload.get("mentioned_concepts"),
        allowed_concepts,
    )
    understanding_signals = _sanitize_understanding_signals(
        payload.get("understanding_signals"),
        allowed_concepts,
    )
    suggested_next_actions = _sanitize_string_list(payload.get("suggested_next_actions"))
    followup_question = _coerce_non_empty_string(payload.get("followup_question")) or ""
    safety_note = _coerce_non_empty_string(payload.get("safety_note")) or ""
    needs_graph_update = bool(understanding_signals)

    return {
        "reply": reply,
        "mentioned_concepts": mentioned_concepts,
        "understanding_signals": understanding_signals,
        "needs_graph_update": needs_graph_update,
        "suggested_next_actions": suggested_next_actions,
        "followup_question": followup_question,
        "safety_note": safety_note,
    }


def _sanitize_mentioned_concepts(
    value: Any,
    allowed_concepts: list[dict] | None,
) -> list[dict[str, str]]:
    if not isinstance(value, list):
        return []

    allowed_index = _allowed_concept_index(allowed_concepts)
    sanitized: list[dict[str, str]] = []
    seen: set[tuple[str, str]] = set()

    for item in value:
        if not isinstance(item, dict):
            continue

        concept_id = _coerce_non_empty_string(item.get("concept_id"))
        node_id = _coerce_non_empty_string(item.get("node_id"))
        concept_name = _coerce_non_empty_string(item.get("concept_name"))
        match_reason = _coerce_non_empty_string(item.get("match_reason")) or "mentioned in context"

        normalized = _lookup_allowed_concept(concept_id, node_id, allowed_index)
        if normalized:
            concept_id = concept_id or normalized.get("concept_id")
            node_id = node_id or normalized.get("node_id")
            concept_name = concept_name or normalized.get("concept_name")

        if not concept_id and not concept_name and not node_id:
            continue

        key = (concept_id or "", node_id or concept_name or "")
        if key in seen:
            continue
        seen.add(key)

        sanitized.append(
            {
                "concept_id": concept_id or "",
                "concept_name": concept_name or "",
                "node_id": node_id or "",
                "match_reason": match_reason,
            }
        )

    return sanitized


def _sanitize_understanding_signals(
    value: Any,
    allowed_concepts: list[dict] | None,
) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []

    allowed_index = _allowed_concept_index(allowed_concepts)
    sanitized: list[dict[str, Any]] = []
    seen: set[tuple[str, str, str]] = set()

    for item in value:
        if not isinstance(item, dict):
            continue

        concept_id = _coerce_non_empty_string(item.get("concept_id"))
        node_id = _coerce_non_empty_string(item.get("node_id"))
        if not _is_allowed_concept(concept_id, node_id, allowed_concepts):
            continue

        normalized = _lookup_allowed_concept(concept_id, node_id, allowed_index)
        if normalized:
            concept_id = concept_id or normalized.get("concept_id")
            node_id = node_id or normalized.get("node_id")
            concept_name = normalized.get("concept_name") or ""
        else:
            concept_name = ""

        signal = _coerce_non_empty_string(item.get("signal")) or "neutral"
        if signal not in SUPPORTED_SIGNALS:
            signal = "neutral"

        raw_score_delta = _clamp_score_delta(item.get("score_delta"))
        score_delta = _normalize_score_delta_for_signal(signal, raw_score_delta)
        confidence = _clamp_float(item.get("confidence"), 0.0, 1.0, default=0.0)
        reason = _coerce_non_empty_string(item.get("reason")) or ""

        key = (concept_id or "", node_id or "", signal)
        if key in seen:
            continue
        seen.add(key)

        sanitized.append(
            {
                "concept_id": concept_id or "",
                "concept_name": concept_name,
                "node_id": node_id or "",
                "signal": signal,
                "score_delta": score_delta,
                "confidence": confidence,
                "reason": reason,
            }
        )

    return sanitized


def _clamp_score_delta(value: Any) -> float:
    return round(_clamp_float(value, -0.05, 0.05, default=0.0), 4)


def _clamp_float(value: Any, minimum: float, maximum: float, default: float = 0.0) -> float:
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return default
    return max(minimum, min(maximum, numeric))


def _is_allowed_concept(
    concept_id: str | None,
    node_id: str | None,
    allowed_concepts: list[dict] | None,
) -> bool:
    if allowed_concepts is None:
        return True
    allowed_index = _allowed_concept_index(allowed_concepts)
    return _lookup_allowed_concept(concept_id, node_id, allowed_index) is not None


def _allowed_concept_index(allowed_concepts: list[dict] | None) -> dict[str, dict[str, Any]]:
    concept_index: dict[str, dict[str, Any]] = {}
    node_index: dict[str, dict[str, Any]] = {}

    for item in allowed_concepts or []:
        if not isinstance(item, dict):
            continue
        concept_id = _coerce_non_empty_string(item.get("concept_id"))
        node_id = _coerce_non_empty_string(item.get("node_id"))
        concept_name = _coerce_non_empty_string(item.get("concept_name") or item.get("name")) or ""
        normalized = {
            "concept_id": concept_id or "",
            "node_id": node_id or "",
            "concept_name": concept_name,
        }
        if concept_id:
            concept_index[concept_id] = normalized
        if node_id:
            node_index[node_id] = normalized

    return {
        "by_concept_id": concept_index,
        "by_node_id": node_index,
    }


def _coerce_non_empty_string(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    stripped = value.strip()
    return stripped or None


def _sanitize_string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [text for text in (_coerce_non_empty_string(item) for item in value) if text]


def _compact_target_concept(value: dict | None) -> dict[str, Any]:
    if not isinstance(value, dict):
        return {}
    return {
        "concept_id": value.get("concept_id"),
        "concept_name": value.get("concept_name") or value.get("name"),
        "description": value.get("description"),
        "group": value.get("group"),
    }


def _compact_graph_context(value: dict | None) -> dict[str, Any]:
    if not isinstance(value, dict):
        return {}

    related_concepts = []
    for item in value.get("related_concepts", []):
        if isinstance(item, dict):
            related_concepts.append(
                {
                    "concept_id": item.get("concept_id"),
                    "concept_name": item.get("concept_name") or item.get("name"),
                }
            )

    relations = []
    for item in value.get("relations", []):
        if isinstance(item, dict):
            relations.append(
                {
                    "source_concept_id": item.get("source_concept_id"),
                    "target_concept_id": item.get("target_concept_id"),
                    "relation_type": item.get("relation_type"),
                }
            )

    return {
        "related_concepts": related_concepts,
        "relations": relations,
    }


def _compact_recent_diagnosis(value: list[dict] | None) -> list[dict[str, Any]]:
    compacted: list[dict[str, Any]] = []
    for item in value or []:
        if not isinstance(item, dict):
            continue
        compacted.append(
            {
                "question_id": item.get("question_id"),
                "answer_score": item.get("answer_score"),
                "feedback_tags": item.get("feedback_tags"),
            }
        )
    return compacted


def _compact_conversation_context(value: list[dict] | None) -> list[dict[str, str]]:
    compacted: list[dict[str, str]] = []
    for item in value or []:
        if not isinstance(item, dict):
            continue
        role = _coerce_non_empty_string(item.get("role"))
        content = _coerce_non_empty_string(item.get("content"))
        if role and content:
            compacted.append({"role": role, "content": content})
    return compacted


def _compact_allowed_concepts(value: list[dict] | None) -> list[dict[str, Any]]:
    compacted: list[dict[str, Any]] = []
    for item in value or []:
        if not isinstance(item, dict):
            continue
        compacted.append(
            {
                "concept_id": item.get("concept_id"),
                "concept_name": item.get("concept_name") or item.get("name"),
                "node_id": item.get("node_id"),
                "understanding_score": item.get("understanding_score"),
                "understanding_level": item.get("understanding_level"),
            }
        )
    return compacted


def _lookup_allowed_concept(
    concept_id: str | None,
    node_id: str | None,
    allowed_index: dict[str, dict[str, Any]],
) -> dict[str, Any] | None:
    if concept_id and concept_id in allowed_index.get("by_concept_id", {}):
        return allowed_index["by_concept_id"][concept_id]
    if node_id and node_id in allowed_index.get("by_node_id", {}):
        return allowed_index["by_node_id"][node_id]
    return None


def _normalize_score_delta_for_signal(signal: str, score_delta: float) -> float:
    if signal == "positive" and score_delta < 0:
        return abs(score_delta)
    if signal in {"confusion", "misconception"} and score_delta > 0:
        return -score_delta
    if signal == "neutral":
        return 0.0
    return score_delta
