import json
import logging
from typing import Any

import boto3
from botocore.exceptions import BotoCoreError, ClientError

from app.core.config import settings


# 공통 LLM 호출 모듈
#
# 역할:
# - AI 모듈이 직접 provider SDK를 호출하지 않도록 Bedrock 호출을 중앙화한다.
# - JSON 응답과 일반 텍스트 응답을 공통 정책으로 처리한다.
# - IAM Role 기반 인증, 최소 재시도, 예외 통일, 기본 로깅을 한곳에서 관리한다.
logger = logging.getLogger(__name__)

DEFAULT_JSON_MAX_TOKENS = 2000
DEFAULT_TEXT_MAX_TOKENS = 1500
DEFAULT_JSON_TEMPERATURE = 0.2
DEFAULT_TEXT_TEMPERATURE = 0.3
ANTHROPIC_VERSION = "bedrock-2023-05-31"


class LLMClientError(Exception):
    """Base exception for LLM client failures."""


class LLMProviderError(LLMClientError):
    """Raised when the provider call fails or returns an invalid payload."""


class LLMJSONParseError(LLMClientError):
    """Raised when JSON output cannot be parsed."""


# JSON 응답용 공개 함수
#
# 역할:
# - 구조화된 응답이 필요한 AI 모듈이 호출하는 진입점이다.
# - 1차 호출 후 JSON 파싱을 시도하고, 실패하면 stricter instruction으로 1회 재시도한다.
# - 최종적으로 Python dict만 반환하며 raw text fallback은 허용하지 않는다.
def call_llm_json(
    system_prompt: str,
    user_prompt: str,
    *,
    task_name: str = "unknown",
    max_tokens: int | None = None,
    temperature: float = DEFAULT_JSON_TEMPERATURE,
    history: list[dict] | None = None,
) -> dict[str, Any]:
    """Call the configured LLM and return a parsed JSON object.

    history(선택): {"role": "user"|"assistant", "content": str} 형식의 과거 대화 턴.
    전달하면 user_prompt 앞에 실제 멀티턴 메시지로 붙는다. None이면 기존과 동일하게
    user_prompt만 단일 user 메시지로 보낸다.
    """
    first_text = _call_bedrock_text(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        task_name=task_name,
        max_tokens=max_tokens or DEFAULT_JSON_MAX_TOKENS,
        temperature=temperature,
        json_only=False,
        history=history,
    )

    try:
        result = _parse_json_response(first_text)
        logger.info(
            "llm_json_success task=%s model_id=%s prompt_chars=%d output_chars=%d retry=%s",
            task_name,
            settings.bedrock_model_id,
            len(system_prompt) + len(user_prompt),
            len(first_text),
            False,
        )
        return result
    except LLMJSONParseError as first_error:
        logger.warning(
            "llm_json_parse_retry task=%s model_id=%s error=%s",
            task_name,
            settings.bedrock_model_id,
            str(first_error),
        )

    retry_text = _call_bedrock_text(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        task_name=task_name,
        max_tokens=max_tokens or DEFAULT_JSON_MAX_TOKENS,
        temperature=temperature,
        json_only=True,
        history=history,
    )

    try:
        result = _parse_json_response(retry_text)
        logger.info(
            "llm_json_success task=%s model_id=%s prompt_chars=%d output_chars=%d retry=%s",
            task_name,
            settings.bedrock_model_id,
            len(system_prompt) + len(user_prompt),
            len(retry_text),
            True,
        )
        return result
    except LLMJSONParseError as error:
        logger.error(
            "llm_json_parse_failed task=%s model_id=%s error=%s",
            task_name,
            settings.bedrock_model_id,
            str(error),
        )
        raise


# 자연어 텍스트 응답용 공개 함수
#
# 역할:
# - explanation 계열처럼 자유 텍스트 응답이 필요한 AI 모듈이 호출하는 진입점이다.
# - 공통 provider 호출 경로와 로깅 정책을 재사용하면서 결과 텍스트만 반환한다.
def call_llm_text(
    system_prompt: str,
    user_prompt: str,
    *,
    task_name: str = "unknown",
    max_tokens: int | None = None,
    temperature: float = DEFAULT_TEXT_TEMPERATURE,
) -> str:
    """Call the configured LLM and return plain text output."""
    text = _call_bedrock_text(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        task_name=task_name,
        max_tokens=max_tokens or DEFAULT_TEXT_MAX_TOKENS,
        temperature=temperature,
        json_only=False,
    )
    logger.info(
        "llm_text_success task=%s model_id=%s prompt_chars=%d output_chars=%d",
        task_name,
        settings.bedrock_model_id,
        len(system_prompt) + len(user_prompt),
        len(text),
    )
    return text


# 멀티턴 messages 구성 내부 함수
#
# 역할:
# - 과거 대화 history와 현재 user_prompt를 Claude Messages API 규칙에 맞는 messages로 만든다.
# - Anthropic 규칙: 반드시 user로 시작하고 user/assistant가 번갈아 나와야 한다.
# - history가 비어있으면 기존과 100% 동일하게 user_prompt 단일 메시지만 반환한다(하위호환).
def _build_messages(history: list[dict] | None, user_prompt: str) -> list[dict[str, Any]]:
    turns: list[dict[str, str]] = []
    for item in history or []:
        if not isinstance(item, dict):
            continue
        role = item.get("role")
        content = item.get("content")
        if role not in ("user", "assistant"):
            continue
        if not isinstance(content, str) or not content.strip():
            continue
        turns.append({"role": role, "content": content})

    # 현재 사용자 입력(user_prompt)을 마지막 user 턴으로 추가
    turns.append({"role": "user", "content": user_prompt})

    # user로 시작해야 하므로 앞쪽 assistant 턴 제거
    while turns and turns[0]["role"] != "user":
        turns.pop(0)

    # 연속된 같은 role 턴을 하나로 병합해 strict alternation 보장
    merged: list[dict[str, str]] = []
    for turn in turns:
        if merged and merged[-1]["role"] == turn["role"]:
            merged[-1]["content"] = f"{merged[-1]['content']}\n\n{turn['content']}"
        else:
            merged.append({"role": turn["role"], "content": turn["content"]})

    return [
        {"role": turn["role"], "content": [{"type": "text", "text": turn["content"]}]}
        for turn in merged
    ]


# Bedrock 호출 내부 함수
#
# 역할:
# - Claude Bedrock Messages API 형식의 payload를 구성한다.
# - boto3의 default credential chain을 그대로 사용해 IAM Role 기반 인증을 따른다.
# - provider/client 오류에 대해 안전한 범위 내에서 1회 재시도한다.
def _call_bedrock_text(
    *,
    system_prompt: str,
    user_prompt: str,
    task_name: str,
    max_tokens: int,
    temperature: float,
    json_only: bool,
    history: list[dict] | None = None,
) -> str:
    client = boto3.client("bedrock-runtime", region_name=settings.aws_region)
    system_text = system_prompt.strip()
    if json_only:
        system_text = (
            f"{system_text}\n\n"
            "Return valid JSON only. Do not include markdown fences, commentary, or extra text."
        ).strip()

    request_body = {
        "anthropic_version": ANTHROPIC_VERSION,
        "max_tokens": max_tokens,
        "temperature": temperature,
        "system": system_text,
        "messages": _build_messages(history, user_prompt),
    }

    provider_error: LLMProviderError | None = None

    for attempt in range(2):
        try:
            response = client.invoke_model(
                modelId=settings.bedrock_model_id,
                body=json.dumps(request_body),
                contentType="application/json",
                accept="application/json",
            )
            text = _extract_text_from_bedrock_response(response)
            if not text.strip():
                raise LLMProviderError("LLM returned an empty text response.")
            return text
        except (ClientError, BotoCoreError) as error:
            provider_error = LLMProviderError(
                f"Bedrock request failed for task '{task_name}': {error}"
            )
            logger.warning(
                "llm_provider_retry task=%s model_id=%s attempt=%d error=%s",
                task_name,
                settings.bedrock_model_id,
                attempt + 1,
                str(error),
            )
            if not _is_retryable_provider_error(error) or attempt == 1:
                logger.error(
                    "llm_provider_failed task=%s model_id=%s error=%s",
                    task_name,
                    settings.bedrock_model_id,
                    str(provider_error),
                )
                raise provider_error
        except LLMProviderError as error:
            logger.error(
                "llm_provider_failed task=%s model_id=%s error=%s",
                task_name,
                settings.bedrock_model_id,
                str(error),
            )
            raise

    if provider_error is None:
        provider_error = LLMProviderError(
            f"Bedrock request failed for task '{task_name}' for an unknown reason."
        )
    raise provider_error


# Bedrock 응답 파싱 내부 함수
#
# 역할:
# - Bedrock HTTP 응답 body를 JSON으로 해석한다.
# - Claude content 배열에서 text block만 추출해 최종 문자열로 합친다.
# - provider 응답 형식이 예상과 다르면 명시적 예외를 발생시킨다.
def _extract_text_from_bedrock_response(response: dict[str, Any]) -> str:
    body = response.get("body")
    if body is None:
        raise LLMProviderError("Bedrock response body is missing.")

    raw_body = body.read()
    try:
        payload = json.loads(raw_body)
    except json.JSONDecodeError as error:
        raise LLMProviderError(f"Bedrock response JSON decode failed: {error}") from error

    content = payload.get("content")
    if not isinstance(content, list):
        raise LLMProviderError("Bedrock response content is missing or invalid.")

    text_parts: list[str] = []
    for item in content:
        if isinstance(item, dict) and item.get("type") == "text":
            text = item.get("text")
            if isinstance(text, str):
                text_parts.append(text)

    result = "".join(text_parts).strip()
    if result:
        return result

    raise LLMProviderError("Bedrock response did not contain Claude text content.")


# JSON 파싱 내부 함수
#
# 역할:
# - 모델 출력 텍스트를 JSON object로 해석한다.
# - 순수 JSON, fenced JSON, 앞뒤 설명이 섞인 JSON 후보를 순서대로 시도한다.
# - JSON array 등 비객체 타입은 허용하지 않고 dict만 반환한다.
def _parse_json_response(text: str) -> dict[str, Any]:
    candidate = text.strip()
    if not candidate:
        raise LLMJSONParseError("LLM returned empty text; JSON parsing is impossible.")

    parse_attempts = [candidate]
    fenced = _extract_fenced_json(candidate)
    if fenced and fenced not in parse_attempts:
        parse_attempts.append(fenced)

    bracketed = _extract_outer_json_object(candidate)
    if bracketed and bracketed not in parse_attempts:
        parse_attempts.append(bracketed)

    last_error: json.JSONDecodeError | None = None
    for attempt in parse_attempts:
        try:
            parsed = json.loads(attempt)
        except json.JSONDecodeError as error:
            last_error = error
            continue

        if not isinstance(parsed, dict):
            raise LLMJSONParseError("LLM JSON output must be a JSON object.")
        return parsed

    if last_error is None:
        raise LLMJSONParseError("LLM JSON output could not be parsed.")
        
    raise LLMJSONParseError(f"LLM JSON parse failed: {last_error}") from last_error


# fenced code block 보정 함수
#
# 역할:
# - 모델이 ```json ... ``` 형태로 감싸서 응답했을 때 내부 본문만 추출한다.
def _extract_fenced_json(text: str) -> str | None:
    stripped = text.strip()
    if not stripped.startswith("```"):
        return None

    lines = stripped.splitlines()
    if len(lines) < 3:
        return None
    if not lines[-1].strip().startswith("```"):
        return None

    return "\n".join(lines[1:-1]).strip()


# 바깥 JSON object 추출 함수
#
# 역할:
# - 모델이 설명 문장과 함께 JSON object를 섞어 반환했을 때 가장 바깥 중괄호 범위를 추출한다.
# - 엄격한 파서는 아니므로 보조 시도용으로만 사용한다.
def _extract_outer_json_object(text: str) -> str | None:
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return None
    return text[start : end + 1].strip()


# provider 재시도 가능 여부 판단 함수
#
# 역할:
# - 일시적 provider/client 오류만 재시도 대상으로 제한한다.
# - throttling, timeout, internal error 같은 경우에만 1회 재시도한다.
def _is_retryable_provider_error(error: Exception) -> bool:
    if isinstance(error, BotoCoreError):
        return True

    if isinstance(error, ClientError):
        error_code = error.response.get("Error", {}).get("Code", "")
        retryable_codes = {
            "ThrottlingException",
            "InternalServerException",
            "ServiceUnavailableException",
            "ModelTimeoutException",
            "TooManyRequestsException",
        }
        return error_code in retryable_codes

    return False
