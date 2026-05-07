# [AI팀 구현] 수준 진단 질문 생성 / 답변 평가

from __future__ import annotations

import json
import random
import re

import boto3

from app.core.config import settings

UNKNOWN_LIKE_STATUSES = {"UNKNOWN", "PARTIAL", "NEEDS_REVIEW", "", None}
LOW_PRIORITY_NAME_PARTS = {"예시", "실습", "요약", "정리", "부록", "참고", "테스트"}
AMBIGUOUS_STATUS = {"status": "PARTIAL", "score": 0.5}
GENERIC_NODE_NAMES = {"개념", "내용", "정리", "요약", "예시", "문제", "테스트"}
WEAK_DESCRIPTION_PARTS = {"핵심 개념", "학습 단위", "관련된 내용", "설명하는 내용"}


def generate_question(node_list: list) -> dict:
    """진단 대상 노드 1개를 선택하고 객관식 질문 1개를 생성한다.

    역할 범위:
    - 진단 대상 노드 선택
    - 질문/선택지 생성
    - DB 업데이트는 하지 않음
    """
    nodes = _normalize_nodes(node_list)
    if not nodes:
        return _fallback_empty_question()

    target = _select_target_node(nodes)
    llm_question = _generate_question_with_llm(target, nodes)
    if llm_question:
        return llm_question

    return _generate_template_question(target, nodes)


def evaluate_answer(question: str, answer: str) -> dict:
    """진단 답안을 평가해 상태와 점수를 반환한다.

    현재 MVP는 객관식 채점을 우선 지원한다.
    - 정답으로 판정되면 KNOWN / high score
    - 오답으로 판정되면 NEEDS_REVIEW / low score
    - 판단 정보가 부족하면 PARTIAL / mid score

    참고:
    - 이 함수는 DB를 갱신하지 않는다.
    - 현재 라우트/서비스는 기존 correct_index 비교를 사용하며,
      이 함수는 이후 통합을 위한 준비 구현이다.
    """
    correctness = _infer_correctness(question, answer)
    if correctness is True:
        return {"status": "KNOWN", "score": 0.9}
    if correctness is False:
        return {"status": "NEEDS_REVIEW", "score": 0.2}
    return AMBIGUOUS_STATUS.copy()


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
                "description": _normalize_text(str(item.get("description", "") or "")),
                "group": _normalize_text(str(item.get("group", "") or "")),
            }
        )
    return normalized


def _select_target_node(nodes: list[dict]) -> dict:
    filtered_nodes = [node for node in nodes if _is_viable_target_node(node)]
    candidate_nodes = filtered_nodes or nodes
    ranked = sorted(candidate_nodes, key=lambda node: (-_score_target_node(node), len(node["name"]), node["name"]))
    return ranked[0]


def _is_viable_target_node(node: dict) -> bool:
    name = node["name"]
    description = node["description"]

    if len(name) <= 1:
        return False
    if name in GENERIC_NODE_NAMES:
        return False
    if any(part in name for part in LOW_PRIORITY_NAME_PARTS):
        return False
    if name.endswith(("...", "…", "-", "/", ":", "→")):
        return False
    if re.search(r"[()/]{2,}|[A-Za-z0-9]{1,2}$", name):
        return False

    if description:
        if len(description) < 8:
            return False
        if any(part in description for part in WEAK_DESCRIPTION_PARTS) and len(description) < 24:
            return False

    return True


def _score_target_node(node: dict) -> int:
    score = 0
    status = node["status"]
    name = node["name"]

    if status == "NEEDS_REVIEW":
        score += 10
    elif status == "UNKNOWN":
        score += 9
    elif status == "PARTIAL":
        score += 8
    else:
        score += 2

    # 짧고 일반적인 이름일수록 핵심 개념일 가능성을 우선 본다.
    word_count = len(name.split())
    if word_count == 1:
        score += 3
    elif word_count == 2:
        score += 2
    elif word_count >= 4:
        score -= 2

    if len(name) <= 8:
        score += 2
    elif len(name) >= 18:
        score -= 2

    if node["description"]:
        score += 1
    if node["group"]:
        score += 1

    if any(part in name for part in LOW_PRIORITY_NAME_PARTS):
        score -= 4

    return score


def _generate_question_with_llm(target: dict, nodes: list[dict]) -> dict | None:
    prompt = _build_llm_prompt(target, nodes)
    if not prompt:
        return None

    try:
        client = boto3.client("bedrock-runtime", region_name=settings.aws_region)
        body = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 800,
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
        return _parse_llm_question("\n".join(text_parts), target["node_id"])
    except Exception:
        return None


def _build_llm_prompt(target: dict, nodes: list[dict]) -> str:
    candidate_nodes = []
    for node in nodes[:12]:
        candidate_nodes.append(
            {
                "name": node["name"],
                "status": node["status"],
                "description": node["description"],
                "group": node["group"],
            }
        )

    return (
        "You are generating one multiple-choice diagnosis question for a learning concept graph.\n"
        "Focus on the target concept only.\n"
        "Use document-grounded concept names from the candidate list.\n"
        "Do not invent unrelated concepts.\n"
        "Return JSON only in this exact shape:\n"
        '{"question":"...", "choices":["...","...","...","..."], "correct_index":0}\n\n'
        f"Target concept: {json.dumps(target, ensure_ascii=False)}\n"
        f"Candidate nodes: {json.dumps(candidate_nodes, ensure_ascii=False)}\n\n"
        "Requirements:\n"
        "- Make one objective multiple-choice question.\n"
        "- Exactly 4 choices.\n"
        "- Only one correct answer.\n"
        "- Keep wording clear enough for MVP diagnosis.\n"
    )


def _parse_llm_question(text: str, node_id: str) -> dict | None:
    if not text:
        return None

    match = re.search(r"\{.*\}", text, re.DOTALL)
    raw_json = match.group(0) if match else text.strip()

    try:
        payload = json.loads(raw_json)
    except json.JSONDecodeError:
        return None

    question = _normalize_text(str(payload.get("question", "")))
    choices = payload.get("choices")
    correct_index = payload.get("correct_index")

    if not question or not isinstance(choices, list) or len(choices) != 4:
        return None
    if not isinstance(correct_index, int) or correct_index not in {0, 1, 2, 3}:
        return None

    normalized_choices = [_normalize_choice(str(choice)) for choice in choices]
    if any(not choice for choice in normalized_choices):
        return None
    if len(set(normalized_choices)) < 4:
        return None

    return {
        "node_id": node_id,
        "question": question,
        "choices": normalized_choices,
        "correct_index": correct_index,
    }


def _generate_template_question(target: dict, nodes: list[dict]) -> dict:
    distractors = _build_distractor_nodes(target, nodes)
    correct_choice = _build_correct_choice(target)
    wrong_choices = [_build_distractor_choice(item) for item in distractors[:3]]

    choices = [correct_choice, *wrong_choices]
    randomizer = random.Random(target["node_id"])
    randomizer.shuffle(choices)
    correct_index = choices.index(correct_choice)

    question = (
        f"다음 중 개념 '{target['name']}'에 대한 설명으로 가장 적절한 것을 고르세요."
    )
    return {
        "node_id": target["node_id"],
        "question": question,
        "choices": choices,
        "correct_index": correct_index,
    }


def _build_distractor_nodes(target: dict, nodes: list[dict]) -> list[dict]:
    others = [node for node in nodes if node["node_id"] != target["node_id"]]
    ranked = sorted(
        others,
        key=lambda node: (
            abs(len(node["name"]) - len(target["name"])),
            -_score_target_node(node),
            node["name"],
        ),
    )
    return ranked


def _build_correct_choice(target: dict) -> str:
    if target["description"]:
        return _normalize_choice(target["description"])
    if target["group"]:
        return _normalize_choice(f"{target['group']} 주제 안에서 {target['name']}의 핵심 정의나 역할을 설명하는 내용")
    return _normalize_choice(f"{target['name']}의 핵심 정의나 역할을 설명하는 내용")


def _build_distractor_choice(node: dict) -> str:
    if node["description"]:
        return _normalize_choice(f"{node['name']}에 대한 설명: {node['description']}")
    if node["group"]:
        return _normalize_choice(f"{node['group']} 주제의 다른 개념인 {node['name']}를 설명하는 내용")
    return _normalize_choice(f"{node['name']}와 관련된 다른 개념을 설명하는 내용")


def _infer_correctness(question: str, answer: str) -> bool | None:
    answer_text = answer.strip()
    if not answer_text:
        return None

    lowered = answer_text.lower()
    if lowered in {"correct", "true", "정답"}:
        return True
    if lowered in {"incorrect", "false", "오답"}:
        return False

    parsed_json = _try_parse_json(answer_text)
    if isinstance(parsed_json, dict):
        if isinstance(parsed_json.get("is_correct"), bool):
            return parsed_json["is_correct"]

        selected_index = _coerce_index(parsed_json.get("selected_index"))
        correct_index = _coerce_index(parsed_json.get("correct_index"))
        if selected_index is not None and correct_index is not None:
            return selected_index == correct_index

        selected = _normalize_text(str(parsed_json.get("selected", "") or ""))
        correct = _normalize_text(str(parsed_json.get("correct", "") or ""))
        if selected and correct:
            return selected == correct

    marker = _extract_correct_index_marker(question)
    selected_index = _extract_index_from_text(answer_text)
    if marker is not None and selected_index is not None:
        return marker == selected_index

    return None


def _extract_correct_index_marker(question: str) -> int | None:
    match = re.search(r"\[\[CORRECT_INDEX:(\d)\]\]", question)
    if not match:
        return None
    index = int(match.group(1))
    return index if index in {0, 1, 2, 3} else None


def _extract_index_from_text(text: str) -> int | None:
    normalized = text.strip()
    circle_map = {"①": 0, "②": 1, "③": 2, "④": 3}
    if normalized in circle_map:
        return circle_map[normalized]

    match = re.search(r"\b([0-3])\b", normalized)
    if match:
        return int(match.group(1))

    match = re.search(r"\b([1-4])\b", normalized)
    if match:
        return int(match.group(1)) - 1

    return None


def _coerce_index(value) -> int | None:
    if isinstance(value, int) and value in {0, 1, 2, 3}:
        return value
    if isinstance(value, str):
        return _extract_index_from_text(value)
    return None


def _try_parse_json(text: str):
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return None


def _normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def _normalize_choice(text: str) -> str:
    return _normalize_text(text).strip(" .")


def _fallback_empty_question() -> dict:
    return {
        "node_id": "unknown",
        "question": "다음 중 기본 개념을 설명하는 내용으로 가장 적절한 것을 고르세요.",
        "choices": [
            "핵심 정의나 역할을 설명하는 내용",
            "무관한 예시만 나열하는 내용",
            "절차만 반복하는 내용",
            "정의 없이 결과만 제시하는 내용",
        ],
        "correct_index": 0,
    }
