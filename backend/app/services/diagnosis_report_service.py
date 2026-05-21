import json
from collections import defaultdict
from pathlib import Path

from sqlalchemy.orm import Session

from app.models.chat import Chat
from app.models.diagnosis import DiagnosisAnswer, DiagnosisQuestion
from app.models.file import File
from app.models.graph import ConceptEdge, ConceptNode
from app.models.project import Project
from app.models.user import User


REPORT_USER_MESSAGE = "수준진단 리포트"
REPORT_STRUCTURE_RESPONSE_TYPE = "diagnosis_report_structure"
REPORT_SUMMARY_RESPONSE_TYPE = "diagnosis_report_summary"

STATUS_LABELS = {
    "MASTERED": "양호",
    "FAMILIAR": "보통 이상",
    "PARTIAL": "보완 필요",
    "WEAK": "보완 필요",
    "UNSEEN": "미진단",
}

WEAK_STATUSES = {"WEAK", "PARTIAL"}

DOMAIN_LABELS = {
    "operating_system": "운영체제",
    "data_structure": "자료구조",
    "algorithm": "알고리즘",
    "computer_network": "컴퓨터 네트워크",
}


def create_diagnosis_report_chats(
    *,
    db: Session,
    project_id: int,
    session_id: str,
    user_id: int,
    chat_session_id: int | None = None,
) -> list[Chat]:
    project = db.query(Project).filter(Project.project_id == project_id).first()
    if not project:
        raise ValueError("프로젝트를 찾을 수 없습니다.")

    nodes = _get_project_nodes(db, project_id)
    if not nodes:
        raise ValueError("리포트를 생성할 개념 노드가 없습니다.")

    answers = _get_session_answers(db, session_id)
    if not answers:
        raise ValueError("해당 session_id의 수준진단 답변이 없습니다.")

    questions_by_id = _get_questions_by_id(db, [answer.question_id for answer in answers])
    user = db.query(User).filter(User.user_id == user_id).first()
    latest_file = _get_latest_file(db, project_id)
    edges = db.query(ConceptEdge).filter(ConceptEdge.project_id == project_id).all()

    structure_message = build_pdf_structure_message(
        project=project,
        nodes=nodes,
        user=user,
        latest_file=latest_file,
    )
    summary_message = build_diagnosis_summary_message(
        project=project,
        nodes=nodes,
        edges=edges,
        answers=answers,
        questions_by_id=questions_by_id,
    )

    chats = [
        Chat(
            user_id=user_id,
            project_id=project_id,
            session_id=chat_session_id,
            user_message=REPORT_USER_MESSAGE,
            ai_response=structure_message,
            response_type=REPORT_STRUCTURE_RESPONSE_TYPE,
        ),
        Chat(
            user_id=user_id,
            project_id=project_id,
            session_id=chat_session_id,
            user_message=REPORT_USER_MESSAGE,
            ai_response=summary_message,
            response_type=REPORT_SUMMARY_RESPONSE_TYPE,
        ),
    ]
    db.add_all(chats)
    db.commit()
    for chat in chats:
        db.refresh(chat)

    return chats


def build_pdf_structure_message(
    *,
    project: Project,
    nodes: list[ConceptNode],
    user: User | None = None,
    latest_file: File | None = None,
) -> str:
    user_name = user.nickname if user and user.nickname else "사용자"
    domain_label = _get_domain_label(project)
    title = _get_structure_title(project, latest_file)
    grouped_nodes = _group_nodes(nodes)
    key_flow = _build_key_flow(grouped_nodes)
    tree = _build_structure_tree(title, grouped_nodes)

    return (
        f"{user_name}님, 이 PDF는 **{domain_label}의 핵심 개념 구조**를 다루는 자료입니다. "
        f"핵심 흐름은 **{key_flow}** 순서로 이어집니다.\n\n"
        "```text\n"
        f"{tree}\n"
        "```"
    )


def build_diagnosis_summary_message(
    *,
    project: Project,
    nodes: list[ConceptNode],
    edges: list[ConceptEdge],
    answers: list[DiagnosisAnswer],
    questions_by_id: dict[str, DiagnosisQuestion],
) -> str:
    answered_nodes = _collect_answered_node_ids(answers, questions_by_id)
    weak_nodes = _get_weak_nodes(nodes, answered_nodes)
    strong_nodes = _get_strong_nodes(nodes, answered_nodes)
    status_tree = _build_status_tree(_get_structure_title(project, None), _group_nodes(nodes), answered_nodes)
    summary_sentence = _build_summary_sentence(project, weak_nodes, strong_nodes)
    learning_path = _build_learning_path(nodes, weak_nodes, edges)

    return (
        f"{_get_domain_label(project)} 개념 정리 수준진단 결과를 바탕으로 학습 리포트를 정리했어요.\n\n"
        "# 퀴즈 결과 요약\n\n"
        f"{summary_sentence}\n\n"
        "PDF 구조상으로 보면 이해 상태는 다음과 같이 정리할 수 있습니다.\n\n"
        "```text\n"
        f"{status_tree}\n"
        "```\n\n"
        "---\n\n"
        "# 추천 학습 경로\n\n"
        "현재 상태에서는 PDF를 처음부터 다시 전부 보는 것보다, 아래 순서로 다시 보는 것이 효율적입니다.\n\n"
        "```text\n"
        f"{learning_path}\n"
        "```\n\n"
        "---\n\n"
        "아래 그래프에서 현재 프로젝트의 개념 흐름을 먼저 훑고, 부족한 노드부터 이어서 질문해보세요."
    )


def _get_project_nodes(db: Session, project_id: int) -> list[ConceptNode]:
    return (
        db.query(ConceptNode)
        .filter(ConceptNode.project_id == project_id)
        .order_by(
            ConceptNode.group.asc(),
            ConceptNode.is_core.desc(),
            ConceptNode.core_score.desc().nullslast(),
            ConceptNode.name.asc(),
        )
        .all()
    )


def _get_session_answers(db: Session, session_id: str) -> list[DiagnosisAnswer]:
    return (
        db.query(DiagnosisAnswer)
        .filter(DiagnosisAnswer.session_id == session_id)
        .order_by(DiagnosisAnswer.created_at.asc())
        .all()
    )


def _get_questions_by_id(db: Session, question_ids: list[str]) -> dict[str, DiagnosisQuestion]:
    if not question_ids:
        return {}

    questions = db.query(DiagnosisQuestion).filter(DiagnosisQuestion.question_id.in_(question_ids)).all()
    return {question.question_id: question for question in questions}


def _get_latest_file(db: Session, project_id: int) -> File | None:
    return (
        db.query(File)
        .filter(File.project_id == project_id)
        .order_by(File.uploaded_at.desc())
        .first()
    )


def _get_domain_label(project: Project) -> str:
    return DOMAIN_LABELS.get(project.project_domain or "", project.project_name or "학습 자료")


def _get_structure_title(project: Project, latest_file: File | None) -> str:
    if latest_file and latest_file.file_name:
        return Path(latest_file.file_name).stem
    return project.project_name or _get_domain_label(project)


def _group_nodes(nodes: list[ConceptNode]) -> dict[str, list[ConceptNode]]:
    grouped: dict[str, list[ConceptNode]] = defaultdict(list)
    for node in nodes:
        grouped[node.group or "주요 개념"].append(node)

    return {
        group: sorted(
            items,
            key=lambda node: (
                -(1 if node.is_core else 0),
                -(node.core_score if node.core_score is not None else 0.0),
                node.name or "",
            ),
        )
        for group, items in sorted(grouped.items(), key=lambda item: item[0])
    }


def _build_key_flow(grouped_nodes: dict[str, list[ConceptNode]]) -> str:
    group_names = list(grouped_nodes.keys())
    if not group_names:
        return "핵심 개념"
    return " → ".join(group_names[:5])


def _build_structure_tree(title: str, grouped_nodes: dict[str, list[ConceptNode]]) -> str:
    lines = [title]
    groups = list(grouped_nodes.items())
    for group_index, (group, nodes) in enumerate(groups):
        is_last_group = group_index == len(groups) - 1
        group_prefix = "└──" if is_last_group else "├──"
        child_prefix = "    " if is_last_group else "│   "
        lines.append(f"{group_prefix} {group}")

        display_nodes = nodes[:5]
        for node_index, node in enumerate(display_nodes):
            is_last_node = node_index == len(display_nodes) - 1 and len(nodes) <= 5
            node_prefix = "└──" if is_last_node else "├──"
            description = f": {node.description}" if node.description else ""
            lines.append(f"{child_prefix}{node_prefix} {node.name}{description}")
        if len(nodes) > 5:
            lines.append(f"{child_prefix}└── 그 외 {len(nodes) - 5}개 개념")

    return "\n".join(lines)


def _build_status_tree(
    title: str,
    grouped_nodes: dict[str, list[ConceptNode]],
    answered_node_ids: set[str],
) -> str:
    lines = [title]
    groups = list(grouped_nodes.items())
    for group_index, (group, nodes) in enumerate(groups):
        is_last_group = group_index == len(groups) - 1
        group_prefix = "└──" if is_last_group else "├──"
        child_prefix = "    " if is_last_group else "│   "
        group_label = _summarize_group_status(nodes, answered_node_ids)
        lines.append(f"{group_prefix} {group}")
        lines.append(f"{child_prefix}└── 이해 상태: {group_label}")

    return "\n".join(lines)


def _summarize_group_status(nodes: list[ConceptNode], answered_node_ids: set[str]) -> str:
    diagnosed_nodes = [node for node in nodes if node.node_id in answered_node_ids or node.status != "UNSEEN"]
    if not diagnosed_nodes:
        return "미진단"
    if any((node.status or "UNSEEN") in WEAK_STATUSES for node in diagnosed_nodes):
        return "보완 필요"
    if any((node.status or "UNSEEN") == "FAMILIAR" for node in diagnosed_nodes):
        return "보통 이상"
    return "양호"


def _collect_answered_node_ids(
    answers: list[DiagnosisAnswer],
    questions_by_id: dict[str, DiagnosisQuestion],
) -> set[str]:
    node_ids: set[str] = set()
    for answer in answers:
        question = questions_by_id.get(answer.question_id)
        if not question:
            continue

        node_ids.add(question.concept_id)

    return node_ids


def _get_weak_nodes(nodes: list[ConceptNode], answered_node_ids: set[str]) -> list[ConceptNode]:
    return [
        node
        for node in nodes
        if node.node_id in answered_node_ids and (node.status or "UNSEEN") in WEAK_STATUSES
    ]


def _get_strong_nodes(nodes: list[ConceptNode], answered_node_ids: set[str]) -> list[ConceptNode]:
    return [
        node
        for node in nodes
        if node.node_id in answered_node_ids and (node.status or "UNSEEN") in {"MASTERED", "FAMILIAR"}
    ]


def _build_summary_sentence(
    project: Project,
    weak_nodes: list[ConceptNode],
    strong_nodes: list[ConceptNode],
) -> str:
    weak_names = _format_node_names(weak_nodes[:3])
    strong_names = _format_node_names(strong_nodes[:3])
    domain_label = _get_domain_label(project)

    if weak_nodes and strong_nodes:
        return (
            f"이번 퀴즈 결과를 보면, 전체적으로 **{strong_names}** 개념은 어느 정도 이해하고 있지만, "
            f"**{weak_names}** 개념에서 보완이 필요한 것으로 보입니다."
        )
    if weak_nodes:
        return (
            f"이번 퀴즈 결과를 보면, **{domain_label}**의 큰 흐름을 다시 잡으면서 "
            f"**{weak_names}** 개념을 우선 보완하는 것이 좋습니다."
        )
    return (
        f"이번 퀴즈 결과를 보면, **{domain_label}**의 주요 개념을 전반적으로 안정적으로 이해하고 있습니다. "
        "다음 단계에서는 관련 개념을 비교하며 정리해보는 것이 좋습니다."
    )


def _build_learning_path(
    nodes: list[ConceptNode],
    weak_nodes: list[ConceptNode],
    edges: list[ConceptEdge],
) -> str:
    if not weak_nodes:
        core_nodes = [node for node in nodes if node.is_core][:3] or nodes[:3]
        names = _format_node_names(core_nodes)
        return (
            "1단계. 핵심 개념 흐름 다시 확인\n"
            f"   └── {names} 중심으로 전체 구조 복습\n\n"
            "2단계. 개념 간 차이 비교\n"
            "   └── 비슷한 개념을 표로 정리\n\n"
            "3단계. 그래프를 보며 질문 확장\n"
            "   └── 연결된 노드 중심으로 추가 질문하기"
        )

    ordered_nodes = _order_learning_nodes(weak_nodes, edges)
    steps = []
    for index, node in enumerate(ordered_nodes[:5], start=1):
        label = STATUS_LABELS.get(node.status or "UNSEEN", "보완 필요")
        hint = _build_node_hint(node)
        steps.append(
            f"{index}단계. {node.name} 집중 복습\n"
            f"   └── 현재 이해 상태: {label}\n"
            f"   └── {hint}"
        )

    if len(ordered_nodes) >= 2:
        compared = " / ".join(node.name for node in ordered_nodes[:3])
        steps.append(
            f"{len(steps) + 1}단계. {compared} 비교 정리\n"
            "   └── 개념 정의, 역할, 차이를 표로 정리"
        )

    return "\n\n".join(steps)


def _order_learning_nodes(weak_nodes: list[ConceptNode], edges: list[ConceptEdge]) -> list[ConceptNode]:
    node_map = {node.node_id: node for node in weak_nodes}
    weak_ids = set(node_map.keys())
    prerequisite_targets = {
        edge.target_node_id
        for edge in edges
        if edge.relation_type == "prerequisite" and edge.source_node_id in weak_ids and edge.target_node_id in weak_ids
    }

    return sorted(
        weak_nodes,
        key=lambda node: (
            1 if node.node_id in prerequisite_targets else 0,
            node.understanding_level if node.understanding_level is not None else 3,
            node.understanding_score if node.understanding_score is not None else 0.5,
            node.name or "",
        ),
    )


def _build_node_hint(node: ConceptNode) -> str:
    if node.description:
        return node.description
    if node.group:
        return f"{node.group} 흐름 안에서 개념의 역할 다시 확인"
    return "정의와 관련 개념을 함께 다시 확인"


def _format_node_names(nodes: list[ConceptNode]) -> str:
    if not nodes:
        return "주요 개념"
    return ", ".join(node.name for node in nodes if node.name)


def _json_loads_list(value: str | None) -> list:
    if not value:
        return []
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        return []
    return parsed if isinstance(parsed, list) else []
