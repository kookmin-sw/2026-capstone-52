import re

from app.ai.language import (
    ENGLISH_RESPONSE_LANGUAGE,
    KOREAN_RESPONSE_LANGUAGE,
    detect_user_response_language,
)
from app.ai.llm_client import LLMClientError, call_llm_text


DEFAULT_CHAT_TITLE = "새 채팅"

REPORT_LIKE_COMPACT_TITLES = {
    "수준진단리포트",
    "진단리포트",
    "진단결과",
    "학습리포트",
    "학습결과",
    "PDF분석",
    "자료분석",
    "미니퀴즈결과",
    "미니퀴즈리포트",
    "퀴즈결과",
    "퀴즈리포트",
}

REPORT_LIKE_ENGLISH_TITLES = {
    "diagnosis report",
    "diagnosis result",
    "learning report",
    "quiz result",
    "quiz report",
    "pdf analysis",
}

KOREAN_TITLE_STOPWORDS = {
    "알려줘",
    "알려주세요",
    "설명해줘",
    "설명해주세요",
    "정리해줘",
    "정리해주세요",
    "궁금해",
    "궁금합니다",
    "해주세요",
    "해줘",
    "뭐야",
    "설명",
    "정리",
}

KOREAN_TITLE_MAX_CHARS = 32

INCOMPLETE_KOREAN_ENDING_REPAIRS = (
    ("차이점은무", "차이점은 무엇인가"),
    ("무엇인", "무엇인가"),
    ("무엇이", "무엇인가"),
    ("어떻게하", "어떻게 하나"),
)


def generate_chat_title(first_user_message: str, *, use_llm: bool = True) -> str:
    """Generate a short title from the first user message without touching DB."""
    if is_report_like_title_source(first_user_message):
        return DEFAULT_CHAT_TITLE

    fallback_title = generate_chat_title_fallback(first_user_message)
    if not use_llm:
        return fallback_title

    response_language = detect_user_response_language(first_user_message)
    if response_language == ENGLISH_RESPONSE_LANGUAGE:
        title_rule = "Write a concise English title of 3-5 words."
    else:
        title_rule = "Write a concise Korean title of 2-8 words with natural Korean spacing."

    system_prompt = (
        "You generate short chat session titles for a CS learning app. "
        f"{title_rule} "
        "Use only the first real user-authored question or request as the source. "
        "Ignore diagnosis reports, quiz reports, system messages, upload analysis summaries, and assistant-generated summaries. "
        f"If the source is report-like, return {DEFAULT_CHAT_TITLE}. "
        "Return only the title text. "
        "Do not use quotation marks. "
        "Do not end with punctuation. "
        "Use natural spacing for Korean titles. "
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

    return _sanitize_title(title, response_language=response_language, fallback_source=first_user_message) or fallback_title


def generate_chat_title_fallback(first_user_message: str) -> str:
    if is_report_like_title_source(first_user_message):
        return DEFAULT_CHAT_TITLE

    response_language = detect_user_response_language(first_user_message)
    return _sanitize_title(first_user_message, response_language=response_language) or DEFAULT_CHAT_TITLE


def is_report_like_title_source(text: str | None) -> bool:
    cleaned = _basic_clean(text)
    if not cleaned:
        return False

    compact = _compact_title(cleaned)
    if compact in REPORT_LIKE_COMPACT_TITLES:
        return True

    lowered = cleaned.casefold()
    if lowered in REPORT_LIKE_ENGLISH_TITLES:
        return True

    # 짧은 자동 생성 메시지만 차단한다. 사용자가 "진단 결과를 설명해줘"처럼
    # 실제 질문을 한 경우까지 막지 않기 위한 보수적 조건이다.
    return len(compact) <= 14 and any(marker in compact for marker in REPORT_LIKE_COMPACT_TITLES)


def _sanitize_title(
    title: str | None,
    *,
    response_language: str,
    fallback_source: str | None = None,
) -> str:
    if not isinstance(title, str):
        return ""

    cleaned = _basic_clean(title)
    if not cleaned:
        return ""

    if is_report_like_title_source(cleaned):
        if fallback_source and not is_report_like_title_source(fallback_source):
            return generate_chat_title_fallback(fallback_source)
        return DEFAULT_CHAT_TITLE

    if response_language == ENGLISH_RESPONSE_LANGUAGE:
        words = cleaned.split()
        if len(words) <= 5:
            return cleaned
        return " ".join(words[:5]).strip()

    if response_language == KOREAN_RESPONSE_LANGUAGE:
        return _build_korean_title(cleaned)

    words = cleaned.split()
    if len(words) > 5:
        return " ".join(words[:5]).strip()
    return _safe_truncate_by_words(cleaned, max_chars=30)


def _basic_clean(text: str | None) -> str:
    if not isinstance(text, str):
        return ""

    cleaned = text.replace("\r", " ").replace("\n", " ")
    cleaned = re.sub(r"[\"'`“”‘’]", "", cleaned)
    cleaned = re.sub(r"https?://\S+", "", cleaned)
    cleaned = re.sub(r"[!?.,;:，。？！…~]+$", "", cleaned)
    cleaned = re.sub(r"[!?.,;:，。？！…~]+", " ", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned.strip("-_()[]{}<>")


def _compact_title(text: str) -> str:
    return re.sub(r"[\s\-_()\[\]{}<>:;,.!?/]+", "", text).casefold()


def _build_korean_title(cleaned: str) -> str:
    tokens = []
    for token in cleaned.split():
        normalized = _normalize_korean_title_token(token)
        if normalized and normalized not in KOREAN_TITLE_STOPWORDS:
            tokens.append(normalized)
        if len(tokens) >= 8:
            break

    if tokens:
        title = _repair_incomplete_korean_ending(" ".join(tokens))
        if _is_valid_korean_title(title):
            return _safe_truncate_by_words(title, max_chars=KOREAN_TITLE_MAX_CHARS)

    repaired = _repair_incomplete_korean_ending(cleaned)
    if _is_valid_korean_title(repaired):
        return _safe_truncate_by_words(repaired, max_chars=KOREAN_TITLE_MAX_CHARS)

    return DEFAULT_CHAT_TITLE


def _normalize_korean_title_token(token: str) -> str:
    token = token.strip()
    token = re.sub(r"(은|는|이|가|을|를|에|에서|으로|로|와|과|의)$", "", token)
    token = re.sub(r"(해줘|해주세요|알려줘|알려주세요|설명해줘|설명해주세요|정리해줘|정리해주세요)$", "", token)
    return token.strip()


def _repair_incomplete_korean_ending(title: str) -> str:
    repaired = re.sub(r"\s+", " ", title or "").strip()
    compact = _compact_title(repaired)
    if compact in REPORT_LIKE_COMPACT_TITLES:
        return DEFAULT_CHAT_TITLE

    for broken, fixed in INCOMPLETE_KOREAN_ENDING_REPAIRS:
        if repaired.endswith(broken):
            return f"{repaired[:-len(broken)].rstrip()} {fixed}".strip()

    if repaired.endswith("은무"):
        return f"{repaired[:-2].rstrip()}은 무엇인가".strip()
    if repaired.endswith("는무"):
        return f"{repaired[:-2].rstrip()}는 무엇인가".strip()
    return repaired


def _is_valid_korean_title(title: str) -> bool:
    if not title or title == DEFAULT_CHAT_TITLE:
        return False
    if is_report_like_title_source(title):
        return False
    return not any(title.endswith(broken) for broken, _ in INCOMPLETE_KOREAN_ENDING_REPAIRS)


def _safe_truncate_by_words(title: str, *, max_chars: int) -> str:
    cleaned = re.sub(r"\s+", " ", title or "").strip()
    if len(cleaned) <= max_chars:
        return cleaned

    words = cleaned.split()
    if len(words) <= 1:
        return cleaned

    shortened = []
    current_length = 0
    for word in words:
        next_length = current_length + len(word) + (1 if shortened else 0)
        if next_length > max_chars:
            break
        shortened.append(word)
        current_length = next_length

    return " ".join(shortened).strip() or cleaned
