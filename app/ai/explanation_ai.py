# [AI팀 구현] 맞춤 설명 생성

from __future__ import annotations

import json
import re

import boto3

from app.core.config import settings

VALID_LEVELS = {"KNOWN", "PARTIAL", "NEEDS_REVIEW", "UNKNOWN"}


def generate_explanation(
    node_name: str,
    description: str,
    user_level: str,
    prerequisite_nodes: list[str] | None = None,
    mastery_score: float | None = None,
    recent_mistakes: list[str] | None = None,
) -> str:
    """개념 설명을 사용자 수준에 맞게 생성한다.

    역할 범위:
    - 개인화된 설명 텍스트 생성만 담당
    - DB/그래프/진단/채팅 상태는 갱신하지 않음

    호환성:
    - 기존 라우트는 세 번째 인자로 사용자 질문을 전달한다.
    - user_level이 유효한 상태값이 아니면 질문/혼동 포인트로 간주하고 PARTIAL로 처리한다.
    """
    normalized = _normalize_inputs(
        node_name=node_name,
        description=description,
        user_level=user_level,
        prerequisite_nodes=prerequisite_nodes,
        mastery_score=mastery_score,
        recent_mistakes=recent_mistakes,
    )

    llm_text = _generate_with_llm(normalized)
    if llm_text:
        return llm_text

    return _generate_with_template(normalized)


def _normalize_inputs(
    node_name: str,
    description: str,
    user_level: str,
    prerequisite_nodes: list[str] | None,
    mastery_score: float | None,
    recent_mistakes: list[str] | None,
) -> dict:
    clean_name = _normalize_text(node_name) or "이 개념"
    clean_description = _normalize_text(description) or f"{clean_name}의 핵심 개념을 설명하는 내용입니다."
    normalized_prerequisites = [_normalize_text(item) for item in (prerequisite_nodes or []) if _normalize_text(item)]
    normalized_mistakes = [_normalize_text(item) for item in (recent_mistakes or []) if _normalize_text(item)]

    level_text = _normalize_text(user_level).upper()
    if level_text not in VALID_LEVELS:
        if _normalize_text(user_level):
            normalized_mistakes = [_normalize_text(user_level), *normalized_mistakes]
        level_text = "PARTIAL"

    score = _clamp_score(mastery_score)
    if level_text == "UNKNOWN":
        level_text = "NEEDS_REVIEW"

    return {
        "node_name": clean_name,
        "description": clean_description,
        "user_level": level_text,
        "prerequisite_nodes": normalized_prerequisites,
        "mastery_score": score,
        "recent_mistakes": normalized_mistakes[:3],
    }


def _generate_with_llm(context: dict) -> str | None:
    prompt = _build_llm_prompt(context)
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

        final_text = _normalize_text("\n".join(text_parts))
        return final_text or None
    except Exception:
        return None


def _build_llm_prompt(context: dict) -> str:
    return (
        "You are generating a personalized explanation for one learning concept.\n"
        "Use only the provided concept context.\n"
        "Do not invent unrelated concepts outside the provided description and prerequisites.\n"
        "Return only the final explanation text in Korean. No JSON, no bullets unless naturally needed.\n\n"
        f"Concept name: {context['node_name']}\n"
        f"Base description: {context['description']}\n"
        f"User level: {context['user_level']}\n"
        f"Mastery score: {context['mastery_score']}\n"
        f"Prerequisite nodes: {json.dumps(context['prerequisite_nodes'], ensure_ascii=False)}\n"
        f"Recent mistakes or question hints: {json.dumps(context['recent_mistakes'], ensure_ascii=False)}\n\n"
        "Style requirements:\n"
        "- KNOWN: short summary, key point, application or connection.\n"
        "- PARTIAL: definition, easy example, common confusion point.\n"
        "- NEEDS_REVIEW: very basic, start from prerequisite if useful, step by step, simple wording.\n"
        "- If recent mistakes exist, address them directly when helpful.\n"
        "- Keep the explanation focused and practical.\n"
    )


def _generate_with_template(context: dict) -> str:
    level = context["user_level"]
    node_name = context["node_name"]
    description = context["description"]
    prerequisites = context["prerequisite_nodes"]
    mastery_score = context["mastery_score"]
    mistakes = context["recent_mistakes"]

    focus_hint = _build_focus_hint(mistakes)
    prerequisite_hint = _build_prerequisite_hint(prerequisites)
    example_text = _build_example_text(node_name)
    confusion_text = _build_confusion_text(node_name, mistakes)
    score_hint = _build_score_hint(level, mastery_score)

    if level == "KNOWN":
        parts = [
            f"{node_name}은(는) {description}",
            "핵심만 다시 잡으면, 이 개념은 정의 자체보다 어디에 적용되는지를 연결해서 이해하는 것이 중요합니다.",
            score_hint or f"{node_name}이 다른 개념과 어떻게 이어지는지 한 번 더 떠올려 보면 좋습니다.",
        ]
        if focus_hint:
            parts.append(focus_hint)
        return " ".join(part for part in parts if part)

    if level == "NEEDS_REVIEW":
        parts = [
            prerequisite_hint or f"{node_name}을(를) 이해하려면 가장 먼저 기본 뜻부터 천천히 잡는 것이 좋습니다.",
            f"{node_name}은(는) {description}",
            f"쉽게 말해, {example_text}",
            confusion_text or f"처음에는 {node_name}의 이름만 외우기보다 무엇을 설명하려는 개념인지부터 구분해 보세요.",
        ]
        if score_hint:
            parts.append(score_hint)
        if focus_hint:
            parts.append(focus_hint)
        return " ".join(part for part in parts if part)

    parts = [
        f"{node_name}은(는) {description}",
        f"간단한 예로는 {example_text}",
        confusion_text or f"헷갈리기 쉬운 부분은 {node_name}의 정의와 쓰임을 따로 보지 않고 섞어서 이해하는 점입니다.",
    ]
    if score_hint:
        parts.append(score_hint)
    if focus_hint:
        parts.append(focus_hint)
    return " ".join(part for part in parts if part)


def _build_prerequisite_hint(prerequisites: list[str]) -> str:
    if not prerequisites:
        return ""
    if len(prerequisites) == 1:
        return f"먼저 {prerequisites[0]}부터 떠올리면 {prerequisites[0]} 위에서 이 개념이 어떻게 확장되는지 이해하기 쉽습니다."
    joined = ", ".join(prerequisites[:2])
    return f"먼저 {joined} 같은 선행 개념을 간단히 떠올린 뒤 이 개념으로 넘어가면 흐름이 더 잘 잡힙니다."


def _build_focus_hint(mistakes: list[str]) -> str:
    if not mistakes:
        return ""
    return f"특히 '{mistakes[0]}' 부분에서 헷갈렸다면, 그 표현이 무엇을 묻는지와 개념의 정의를 먼저 연결해서 보세요."


def _build_confusion_text(node_name: str, mistakes: list[str]) -> str:
    if mistakes:
        return f"자주 생기는 혼동은 '{mistakes[0]}'처럼 질문의 표현만 보고 답하려는 점인데, 먼저 {node_name}의 뜻을 정확히 잡는 것이 더 중요합니다."
    return ""


def _build_example_text(node_name: str) -> str:
    return f"{node_name}을(를) 실제 문제나 사례에서 만났을 때, 먼저 이 개념이 무엇을 설명하는지 한 문장으로 말해 보는 방식입니다."


def _build_score_hint(level: str, mastery_score: float | None) -> str:
    if mastery_score is None:
        return ""
    if level == "KNOWN" and mastery_score >= 0.85:
        return "현재 이해도는 비교적 안정적이므로, 세부 정의보다 활용 맥락을 연결해서 정리하면 좋습니다."
    if level == "PARTIAL" and mastery_score < 0.6:
        return "아직 이해가 완전히 굳지 않았을 수 있으니, 정의와 대표 예시를 함께 묶어서 기억하는 것이 도움이 됩니다."
    if level == "NEEDS_REVIEW" and mastery_score < 0.4:
        return "지금은 세부 응용보다 가장 기본 정의와 선행 개념을 먼저 다시 잡는 편이 안전합니다."
    return ""


def _clamp_score(value: float | None) -> float | None:
    if value is None:
        return None
    try:
        score = float(value)
    except (TypeError, ValueError):
        return None
    return max(0.0, min(1.0, score))


def _normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()
