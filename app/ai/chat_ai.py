# [AI팀 구현] 채팅 처리 + 이해 여부 판단


def process_chat(message: str, node_list: list) -> dict:
    """채팅 메시지에 응답하고, 이해한 것으로 판단된 개념 node_id 목록 반환

    node_list 형식: [{"node_id": str, "name": str, "status": str}]

    반환 형식:
    {
      "reply": str,              # 챗봇 응답 텍스트
      "understood_nodes": [str]  # 모름→앎으로 전환할 node_id 목록
    }
    """
    raise NotImplementedError
