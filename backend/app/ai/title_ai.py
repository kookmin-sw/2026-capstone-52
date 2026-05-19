import re

from app.ai.language import (
    ENGLISH_RESPONSE_LANGUAGE,
    KOREAN_RESPONSE_LANGUAGE,
    detect_user_response_language,
)
from app.ai.llm_client import LLMClientError, call_llm_text


DEFAULT_CHAT_TITLE = "새 채팅"


def generate_chat_title(first_user_message: str, *, use_llm: bool = True) -> str:
    """Generate a short title from the first user message without touching DB."""
    fallback_title = generate_chat_title_fallback(first_user_message)
    if not use_llm:
        return fallback_title

    response_language = detect_user_response_language(first_user_message)
    if response_language == ENGLISH_RESPONSE_LANGUAGE:
        title_rule = "Write a concise English title of 3-5 words."
    else:
        title_rule = "Write a concise Korean title around 10-15 Korean characters."

    system_prompt = (
        "You generate short chat session titles for a CS learning app. "
        f"{title_rule} "
        "Use the first user message as the only source. "
        "Return only the title text. "
        "Do not use quotation marks. "
        "Do not end with punctuation. "
        "Do not include explanations, prefixes, JSON, or markdown."
    )
    user_prompt = f"first_user_message:\n{first_user_message or ''}"

    try:
        title = call_llm_text(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            task_name="title_ai_generate_chat_title",
            temperature=0.2,
            max_tokens=80,
        )
    except LLMClientError:
        return fallback_title

    return _sanitize_title(title, response_language=response_language) or fallback_title


def generate_chat_title_fallback(first_user_message: str) -> str:
    response_language = detect_user_response_language(first_user_message)
    return _sanitize_title(first_user_message, response_language=response_language) or DEFAULT_CHAT_TITLE


def _sanitize_title(title: str | None, *, response_language: str) -> str:
    if not isinstance(title, str):
        return ""

    cleaned = title.replace("\r", " ").replace("\n", " ")
    cleaned = re.sub(r"[\"'`“”‘’]", "", cleaned)
    cleaned = re.sub(r"https?://\S+", "", cleaned)
    cleaned = re.sub(r"[!?.,;:，。？！…~]+$", "", cleaned)
    cleaned = re.sub(r"[!?.,;:，。？！…~]+", " ", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    cleaned = cleaned.strip("-_()[]{}<>")
    if not cleaned:
        return ""

    if response_language == ENGLISH_RESPONSE_LANGUAGE:
        words = cleaned.split()
        if len(words) <= 5:
            return cleaned
        return " ".join(words[:5]).strip()

    if response_language == KOREAN_RESPONSE_LANGUAGE:
        compact = cleaned.replace(" ", "")
        if len(compact) <= 15:
            return compact
        return compact[:15].rstrip()

    words = cleaned.split()
    if len(words) > 5:
        return " ".join(words[:5]).strip()
    return cleaned[:30].strip()
