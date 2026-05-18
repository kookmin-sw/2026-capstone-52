import { apiRequest } from "../api/client";

export const isMiniQuizBackendApiEnabled = process.env.NEXT_PUBLIC_USE_BACKEND_API === "true";

function normalizeQuestionList(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }
  return value ? [value] : [];
}

function normalizeQuestionPayload(payload) {
  const questions = normalizeQuestionList(payload?.data ?? payload);

  return {
    questions,
    group: payload?.group ?? null,
    message: payload?.message ?? "",
    raw: payload,
  };
}

function normalizeDeferredPayload(payload) {
  return {
    items: normalizeQuestionList(payload?.data ?? payload),
    groups: Array.isArray(payload?.groups) ? payload.groups : [],
    message: payload?.message ?? "",
    raw: payload,
  };
}

/**
 * generate/defer payload shape:
 * { success: true, data: DiagnosisQuestionResponse[], group: { node_id, node_name, question_ids }, message }
 */
export async function generateApiMiniQuizQuestion(projectId, nodeId) {
  const query = `?node_id=${encodeURIComponent(nodeId)}`;
  const payload = await apiRequest(`/mini-quiz/${encodeURIComponent(projectId)}/generate${query}`, {
    method: "POST",
    unwrap: false,
  });
  return normalizeQuestionPayload(payload);
}

export async function submitApiMiniQuizAnswer(
  projectId,
  questionId,
  { selectedOptionIds = null, isSkipped = false } = {}
) {
  const body = {
    question_id: questionId,
    is_skipped: isSkipped,
  };

  if (Array.isArray(selectedOptionIds) && selectedOptionIds.length > 0) {
    body.selected_option_ids = selectedOptionIds;
  }

  return apiRequest(`/mini-quiz/${encodeURIComponent(projectId)}/submit`, {
    method: "POST",
    body,
  });
}

export async function submitApiMiniQuizAnswers(projectId, answers) {
  const body = {
    answers: (Array.isArray(answers) ? answers : []).map((answer) => {
      const item = {
        question_id: answer.questionId ?? answer.question_id,
        is_skipped: Boolean(answer.isSkipped ?? answer.is_skipped),
      };

      const selectedOptionIds = answer.selectedOptionIds ?? answer.selected_option_ids;
      if (Array.isArray(selectedOptionIds) && selectedOptionIds.length > 0) {
        item.selected_option_ids = selectedOptionIds;
      }

      return item;
    }),
  };

  return apiRequest(`/mini-quiz/${encodeURIComponent(projectId)}/submit`, {
    method: "POST",
    body,
  });
}

export async function getApiMiniQuizReview(projectId, questionIds) {
  if (!questionIds?.length) {
    return [];
  }
  const query = `?question_ids=${questionIds.map(encodeURIComponent).join(",")}`;
  return apiRequest(`/mini-quiz/${encodeURIComponent(projectId)}/review${query}`, {
    method: "GET",
  });
}

export async function deferApiMiniQuizQuestion(projectId, nodeId, questionIds) {
  const hasQuestionIds = Array.isArray(questionIds) && questionIds.length > 0;
  const query = hasQuestionIds ? "" : `?node_id=${encodeURIComponent(nodeId)}`;
  const body = hasQuestionIds ? { question_ids: questionIds.map(String) } : undefined;
  const payload = await apiRequest(`/mini-quiz/${encodeURIComponent(projectId)}/defer${query}`, {
    method: "POST",
    body,
    unwrap: false,
  });
  return normalizeQuestionPayload(payload);
}

/**
 * deferred payload shape:
 * { success: true, data: DeferredMiniQuizItem[], groups: DeferredMiniQuizGroup[], message }
 */
export async function getApiDeferredMiniQuizzes(projectId) {
  const payload = await apiRequest(`/mini-quiz/${encodeURIComponent(projectId)}/deferred`, {
    method: "GET",
    unwrap: false,
  });
  return normalizeDeferredPayload(payload);
}
