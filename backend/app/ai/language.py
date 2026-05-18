import re


KOREAN_RESPONSE_LANGUAGE = "Korean"
ENGLISH_RESPONSE_LANGUAGE = "English"


def detect_user_response_language(text: str | None, *, honor_explicit_request: bool = True) -> str:
    """Return Korean by default, English only for clearly English user text."""
    if not isinstance(text, str):
        return KOREAN_RESPONSE_LANGUAGE

    normalized = text.strip()
    if not normalized:
        return KOREAN_RESPONSE_LANGUAGE

    lowered = normalized.casefold()
    if honor_explicit_request:
        if _requests_korean(lowered):
            return KOREAN_RESPONSE_LANGUAGE
        if _requests_english(lowered):
            return ENGLISH_RESPONSE_LANGUAGE

    hangul_count = len(re.findall(r"[가-힣]", normalized))
    english_words = re.findall(r"[A-Za-z]{2,}", normalized)

    if hangul_count > 0:
        return KOREAN_RESPONSE_LANGUAGE
    if len(english_words) >= 3:
        return ENGLISH_RESPONSE_LANGUAGE
    return KOREAN_RESPONSE_LANGUAGE


def response_language_instruction(response_language: str) -> str:
    if response_language == ENGLISH_RESPONSE_LANGUAGE:
        return (
            "Write all user-facing text in English. "
            "Keep JSON keys and internal identifiers unchanged."
        )
    return (
        "Write all user-facing text in Korean by default. "
        "English CS terms may be included in parentheses when helpful, for example 큐(queue) or 스택(stack). "
        "Keep JSON keys and internal identifiers unchanged."
    )


def _requests_english(lowered_text: str) -> bool:
    patterns = [
        "answer in english",
        "respond in english",
        "explain in english",
        "use english",
        "영어로",
        "영문으로",
    ]
    return any(pattern in lowered_text for pattern in patterns)


def _requests_korean(lowered_text: str) -> bool:
    patterns = [
        "answer in korean",
        "respond in korean",
        "explain in korean",
        "use korean",
        "한국어로",
        "한글로",
        "우리말로",
    ]
    return any(pattern in lowered_text for pattern in patterns)
