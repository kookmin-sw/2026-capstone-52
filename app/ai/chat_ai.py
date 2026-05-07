# [AI팀 구현] 채팅 처리 + 이해 여부 판단

from __future__ import annotations

import json
import re

import boto3

from app.core.config import settings

UNDERSTANDING_SIGNALS = {
    "즉",
    "정리하면",
    "그러면",
    "라는 거죠",
    "인 거죠",
    "이거네요",
    "거군요",
    "맞죠",
    "맞나요",
}
CONFUSION_SIGNALS = {
    "모르겠",
    "헷갈",
    "어려",
    "설명해",
    "이해 안",
    "무슨 뜻",
    "잘 모르",
}
GENERIC_FALLBACK = "궁금한 개념을 한 문장으로 정리해 보거나, 어디가 헷갈리는지 같이 말해 주면 더 정확하게 도와드릴 수 있어요."


def process_chat(message: str, node_list: list) -> dict:
    """사용자 메시지에 답하고, 이해한 것으로 보이는 개념 node_id를 보수적으로 추론한다.

    역할 범위:
    - 관련 개념 찾기
    - 응답 생성
    - understood_nodes 반환
    - DB/그래프 상태는 직접 갱신하지 않음
    """
    normalized_message = _normalize_text(message)
    nodes = _normalize_nodes(node_list)
    matched_nodes = _match_relevant_nodes(normalized_message, nodes)

    llm_result = _generate_with_llm(normalized_message, nodes, matched_nodes)
    if llm_result:
        return _post_validate_result(llm_result, normalized_message, matched_nodes, nodes)

    return _generate_with_template(normalized_message, matched_nodes, nodes)


def _normalize_nodes(node_list: list) -> list[dict]:
    normalized = []
    for item in node_list:
        if not isinstance(item, dict):
            continue
        node_id = str(item.get("node_id", "")).strip()
        name = _normalize_text(str(item.get("name", "")))
        if not node_id or not name:
            continue
        normalized.append(
            {
                "node_id": node_id,
                "name": name,
                "status": str(item.get("status", "UNKNOWN") or "UNKNOWN").upper(),
            }
        )
    return normalized


def _match_relevant_nodes(message: str, nodes: list[dict]) -> list[dict]:
    scored = []
    message_key = _normalize_key(message)

    for node in nodes:
        name = node["name"]
        key = _normalize_key(name)
        score = 0

        if name in message:
            score += 6
        if key and key in message_key:
            score += 4

        name_tokens = [token for token in re.split(r"\s+", name) if len(token) >= 2]
        token_hits = sum(1 for token in name_tokens if token in message)
        score += token_hits * 2

        if node["status"] in {"UNKNOWN", "PARTIAL", "NEEDS_REVIEW"}:
            score += 1

        if score > 0:
            scored.append((score, len(name), node))

    scored.sort(key=lambda item: (-item[0], item[1], item[2]["name"]))
    return [item[2] for item in scored[:3]]


def _generate_with_llm(message: str, nodes: list[dict], matched_nodes: list[dict]) -> dict | None:
    prompt = _build_llm_prompt(message, nodes, matched_nodes)
    if not prompt:
        return None

    try:
        client = boto3.client("bedrock-runtime", region_name=settings.aws_region)
        body = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 900,
            "temperature": 0.2,
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
        return _parse_llm_result("\n".join(text_parts))
    except Exception:
        return None


def _build_llm_prompt(message: str, nodes: list[dict], matched_nodes: list[dict]) -> str:
    context_nodes = matched_nodes if matched_nodes else nodes[:8]
    node_payload = [
        {"node_id": node["node_id"], "name": node["name"], "status": node["status"]}
        for node in context_nodes
    ]

    return (
        "You are helping a learner using a concept graph.\n"
        "Use only the user message and provided nodes.\n"
        "Do not invent unrelated concepts.\n"
        "Return JSON only in this exact shape:\n"
        '{"reply":"...", "understood_nodes":["node_id1"]}\n\n'
        f"User message: {message}\n"
        f"Relevant nodes: {json.dumps(node_payload, ensure_ascii=False)}\n\n"
        "Rules:\n"
        "- reply should be a helpful Korean chat response.\n"
        "- understood_nodes must be conservative.\n"
        "- Only include node_ids if the message strongly indicates the user understood that concept.\n"
        "- Mere mention or request for explanation is not enough.\n"
    )


def _parse_llm_result(text: str) -> dict | None:
    if not text:
        return None

    match = re.search(r"\{.*\}", text, re.DOTALL)
    raw_json = match.group(0) if match else text.strip()

    try:
        payload = json.loads(raw_json)
    except json.JSONDecodeError:
        return None

    reply = _normalize_text(str(payload.get("reply", "")))
    understood_nodes = payload.get("understood_nodes", [])
    if not reply or not isinstance(understood_nodes, list):
        return None

    return {
        "reply": reply,
        "understood_nodes": [str(node_id).strip() for node_id in understood_nodes if str(node_id).strip()],
    }


def _post_validate_result(result: dict, message: str, matched_nodes: list[dict], all_nodes: list[dict]) -> dict:
    valid_ids = {node["node_id"] for node in all_nodes}
    strong_understood = _infer_understood_nodes(message, matched_nodes)
    llm_understood = [node_id for node_id in result.get("understood_nodes", []) if node_id in valid_ids]

    # LLM 결과도 보수적 규칙을 통과한 경우에만 반영한다.
    understood_nodes = [node_id for node_id in llm_understood if node_id in strong_understood]

    return {
        "reply": result["reply"],
        "understood_nodes": understood_nodes,
    }


def _generate_with_template(message: str, matched_nodes: list[dict], all_nodes: list[dict]) -> dict:
    understood_nodes = _infer_understood_nodes(message, matched_nodes)

    if matched_nodes:
        primary = matched_nodes[0]
        if understood_nodes:
            reply = (
                f"맞아요. 지금 표현한 내용을 보면 '{primary['name']}'의 핵심 뜻을 잘 잡고 있어요. "
                f"이제는 이 개념이 언제 쓰이는지나 비슷한 개념과 무엇이 다른지도 함께 정리해 보면 더 안정적으로 이해할 수 있어요."
            )
        elif _looks_confused(message):
            reply = (
                f"'{primary['name']}'부터 다시 천천히 보죠. "
                f"먼저 이 개념이 무엇을 설명하는지 한 문장으로 정리한 뒤, 어디에서 쓰이는지를 예시와 함께 보면 이해가 더 쉬워집니다."
            )
        else:
            related_names = ", ".join(node["name"] for node in matched_nodes[:2])
            reply = (
                f"지금 질문은 {related_names}와 관련 있어 보여요. "
                f"우선 '{primary['name']}'의 핵심 뜻을 먼저 잡고, 그다음 이 개념이 어떤 상황에서 쓰이는지 연결해서 보면 좋습니다."
            )
    else:
        reply = GENERIC_FALLBACK

    return {
        "reply": reply,
        "understood_nodes": understood_nodes,
    }


def _infer_understood_nodes(message: str, matched_nodes: list[dict]) -> list[str]:
    if not matched_nodes:
        return []
    if not _has_understanding_signal(message):
        return []
    if _looks_confused(message):
        return []

    understood = []
    for node in matched_nodes[:2]:
        if _node_is_clearly_referenced(message, node):
            understood.append(node["node_id"])
    return understood[:1]


def _has_understanding_signal(message: str) -> bool:
    return any(signal in message for signal in UNDERSTANDING_SIGNALS)


def _looks_confused(message: str) -> bool:
    lowered = message.lower()
    return any(signal in lowered for signal in CONFUSION_SIGNALS) or "?" in message and not _has_understanding_signal(message)


def _node_is_clearly_referenced(message: str, node: dict) -> bool:
    name = node["name"]
    key = _normalize_key(name)
    message_key = _normalize_key(message)

    if name in message:
        return True
    if key and key in message_key:
        return True

    tokens = [token for token in re.split(r"\s+", name) if len(token) >= 2]
    return sum(1 for token in tokens if token in message) >= 2


def _normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def _normalize_key(text: str) -> str:
    return re.sub(r"[^A-Za-z가-힣0-9]", "", text).lower()
