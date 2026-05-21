"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import MarkdownContent from "@/components/common/MarkdownContent";
import {
  generateApiMiniQuizQuestion,
  isMiniQuizBackendApiEnabled,
  submitApiMiniQuizAnswer,
  submitApiMiniQuizAnswers,
} from "../../features/mini-quiz/api-service";
import { buildMockMiniQuizAnswerResponse, getMockMiniQuizQuestion } from "../../features/mini-quiz/mock-data";

const MOCK_LATENCY_MS = 380;
const miniQuizQuestionLoadingDotVariants = {
  jump: {
    y: -30,
    transition: {
      duration: 0.8,
      repeat: Infinity,
      repeatType: "mirror",
      ease: "easeInOut",
    },
  },
};

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function MiniQuizQuestionLoadingOverlay() {
  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="workspace-mini-quiz-opening-overlay">
      <motion.div
        animate="jump"
        transition={{ staggerChildren: -0.2, staggerDirection: -1 }}
        className="workspace-mini-quiz-opening-loader"
        role="status"
        aria-label="미니퀴즈 문제를 준비하는 중"
      >
        <motion.div className="workspace-mini-quiz-opening-dot" variants={miniQuizQuestionLoadingDotVariants} />
        <motion.div className="workspace-mini-quiz-opening-dot" variants={miniQuizQuestionLoadingDotVariants} />
        <motion.div className="workspace-mini-quiz-opening-dot" variants={miniQuizQuestionLoadingDotVariants} />
      </motion.div>
    </div>,
    document.body
  );
}

function normalizeChoice(choice, index) {
  if (choice && typeof choice === "object") {
    const optionId = choice.option_id ?? choice.optionId ?? null;
    return {
      id: String(optionId ?? choice.id ?? choice.value ?? index),
      optionId: optionId !== null ? String(optionId) : null,
      label: choice.text || choice.label || String(choice.value ?? index),
    };
  }

  return { id: String(index), optionId: null, label: String(choice) };
}

function isUnknownChoice(choice) {
  return /잘\s*모르겠어요/.test(choice?.label || "");
}

function buildReviewEntry({ question, choices, result, selectedOptionIds, currentTarget }) {
  const correctSet = new Set(Array.isArray(result.correct_option_ids) ? result.correct_option_ids : []);
  const selectedFromResult = Array.isArray(result.selected_option_ids)
    ? result.selected_option_ids
    : selectedOptionIds;
  const selectedSet = new Set(selectedFromResult);

  return {
    question_id: getQuestionId(question),
    concept_id: question.concept_id || currentTarget.nodeId,
    question: question.question,
    choices: choices.map((choice) => ({
      option_id: choice.optionId || choice.id,
      text: choice.label,
      is_correct: choice.optionId ? correctSet.has(choice.optionId) : false,
      is_selected: choice.optionId ? selectedSet.has(choice.optionId) : false,
    })),
    correct_option_ids: Array.from(correctSet),
    selected_option_ids: selectedFromResult,
    is_fully_correct: result.is_fully_correct ?? null,
    partial_score: result.partial_score ?? null,
    answer_score: result.answer_score ?? null,
    explanation: result.explanation || question.explanation || "",
    // 백엔드 QuizQuestionReview.source 와 동일 값 — 추후 백엔드 응답으로 대체될 수 있음.
    source: "mini_quiz",
  };
}

function getQuestionId(question) {
  return question?.question_id ?? question?.questionId ?? null;
}

function getTargetGroupKey(target) {
  const questionIds = target?.group?.questionIds ?? target?.group?.question_ids;
  if (Array.isArray(questionIds) && questionIds.length > 0) {
    return questionIds.join("|");
  }
  return target?.groupKey || null;
}

export default function MiniQuizPopup({
  projectId,
  chatSessionId = null,
  conceptNodeId,
  conceptName,
  conceptQueue,
  onClose,
  onComplete,
  onResult,
}) {
  // 단일 노드 mode와 큐 mode 둘 다 지원.
  // - conceptQueue를 주면 순서대로 진행
  // - 주지 않으면 conceptNodeId / conceptName 단건 진행
  const queue = useMemo(() => {
    if (Array.isArray(conceptQueue) && conceptQueue.length > 0) {
      return conceptQueue;
    }
    if (conceptNodeId) {
      return [{ nodeId: conceptNodeId, name: conceptName || null }];
    }
    return [];
  }, [conceptQueue, conceptNodeId, conceptName]);
  const queueKey = useMemo(
    () =>
      queue
        .map((item) => `${item.nodeId || ""}:${item.presetQuestion?.question_id || ""}`)
        .join("|"),
    [queue]
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const [visibleQuestionIndex, setVisibleQuestionIndex] = useState(0);
  const [step, setStep] = useState("loading"); // loading | quiz | complete | answers | error
  const [loadingReason, setLoadingReason] = useState("question"); // question | submit
  const [question, setQuestion] = useState(null);
  const [choices, setChoices] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [submittedResults, setSubmittedResults] = useState([]);
  const [pendingBackendAnswers, setPendingBackendAnswers] = useState([]);
  const [answerIndex, setAnswerIndex] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  // 제출이 완료된 노드만 부모에게 보고 — 닫기로 끝낸 미풀이 항목은 제외해 deferred/trigger를 유지한다.
  const completedNodeIdsRef = useRef(new Set());

  const currentTarget = queue[currentIndex] || null;
  const totalCount = queue.length;
  const isLastInQueue = totalCount > 0 && currentIndex >= totalCount - 1;
  const shouldUseMockMiniQuiz = Boolean(currentTarget?.useMockMiniQuiz);

  useEffect(() => {
    setCurrentIndex(0);
    setVisibleQuestionIndex(0);
    setSelectedIds([]);
    setSubmittedResults([]);
    setPendingBackendAnswers([]);
    setAnswerIndex(0);
    setErrorMessage("");
    setLoadingReason("question");
    completedNodeIdsRef.current.clear();
  }, [projectId, queueKey]);

  function handleClose() {
    onClose?.({
      completedNodeIds: Array.from(completedNodeIdsRef.current),
      results: submittedResults,
    });
  }

  function completeQuiz(nextSubmittedResults) {
    const completePayload = {
      completedNodeIds: Array.from(completedNodeIdsRef.current),
      results: nextSubmittedResults,
    };

    if (typeof onResult === "function") {
      nextSubmittedResults.forEach((entry) => {
        onResult({
          nodeId: entry.currentTarget.nodeId,
          conceptName: entry.currentTarget.name,
          reviewEntry: entry.reviewEntry,
        });
      });
    }

    nextSubmittedResults.forEach((entry) => {
      if (entry.currentTarget?.nodeId) {
        completedNodeIdsRef.current.add(entry.currentTarget.nodeId);
      }
    });
    completePayload.completedNodeIds = Array.from(completedNodeIdsRef.current);
    onComplete?.(completePayload);
    onClose?.(completePayload);
  }

  async function submitBackendAnswerGroups(answerEntries) {
    const groupedEntries = [];
    const groupedEntryByKey = new Map();

    answerEntries.forEach((entry) => {
      const groupKey = getTargetGroupKey(entry.currentTarget) || `single:${getQuestionId(entry.question)}`;
      if (!groupedEntryByKey.has(groupKey)) {
        const group = { key: groupKey, entries: [] };
        groupedEntryByKey.set(groupKey, group);
        groupedEntries.push(group);
      }
      groupedEntryByKey.get(groupKey).entries.push(entry);
    });

    const completedEntries = [];

    for (const group of groupedEntries) {
      const hasBackendGroup =
        group.entries.length > 1 ||
        Array.isArray(group.entries[0]?.currentTarget?.group?.questionIds) ||
        Array.isArray(group.entries[0]?.currentTarget?.group?.question_ids);

      if (hasBackendGroup) {
        const result = await submitApiMiniQuizAnswers(
          projectId,
          group.entries.map((entry) => ({
            questionId: getQuestionId(entry.question),
            selectedOptionIds: entry.selectedOptionIds,
            isSkipped: entry.isSkipped,
          })),
          { sessionId: chatSessionId }
        );
        const questionResultById = new Map(
          (Array.isArray(result?.question_results) ? result.question_results : []).map((questionResult) => [
            questionResult.question_id,
            questionResult,
          ])
        );

        group.entries.forEach((entry) => {
          const questionId = getQuestionId(entry.question);
          const questionResult = questionResultById.get(questionId) || result;
          const reviewEntry = buildReviewEntry({
            question: entry.question,
            choices: entry.choices,
            result: questionResult,
            selectedOptionIds: entry.selectedOptionIds,
            currentTarget: entry.currentTarget,
          });
          completedEntries.push({
            ...entry,
            result: questionResult,
            backendResult: result,
            selectedOptionIds: reviewEntry.selected_option_ids,
            reviewEntry,
          });
        });
        continue;
      }

      const entry = group.entries[0];
      const result = await submitApiMiniQuizAnswer(projectId, getQuestionId(entry.question), {
        selectedOptionIds: entry.isSkipped ? null : entry.selectedOptionIds.length ? entry.selectedOptionIds : null,
        isSkipped: entry.isSkipped,
        sessionId: chatSessionId,
      });
      const reviewEntry = buildReviewEntry({
        question: entry.question,
        choices: entry.choices,
        result,
        selectedOptionIds: entry.selectedOptionIds,
        currentTarget: entry.currentTarget,
      });
      completedEntries.push({
        ...entry,
        result,
        backendResult: result,
        selectedOptionIds: reviewEntry.selected_option_ids,
        reviewEntry,
      });
    }

    return completedEntries;
  }

  useEffect(() => {
    if (!projectId || !currentTarget) {
      return undefined;
    }

    let cancelled = false;
    setLoadingReason("question");
    setStep("loading");
    setSelectedIds([]);
    setErrorMessage("");

    const preset = currentTarget.presetQuestion;
    if (preset && getQuestionId(preset)) {
      const rawChoices = Array.isArray(preset.choices) ? preset.choices : [];
      setQuestion(preset);
      setChoices(rawChoices.map(normalizeChoice).filter((choice) => !isUnknownChoice(choice)));
      setVisibleQuestionIndex(currentIndex);
      setStep("quiz");
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      try {
        const data = isMiniQuizBackendApiEnabled && !shouldUseMockMiniQuiz
          ? await generateApiMiniQuizQuestion(projectId, currentTarget.nodeId)
          : await delay(MOCK_LATENCY_MS).then(() => getMockMiniQuizQuestion(currentTarget.nodeId));
        if (cancelled) return;
        const generatedQuestion = Array.isArray(data?.questions) ? data.questions[0] : data;
        if (!generatedQuestion) {
          throw new Error("생성된 미니퀴즈가 없습니다.");
        }
        const rawChoices = Array.isArray(generatedQuestion?.choices) ? generatedQuestion.choices : [];
        setQuestion(generatedQuestion);
        setChoices(rawChoices.map(normalizeChoice).filter((choice) => !isUnknownChoice(choice)));
        setVisibleQuestionIndex(currentIndex);
        setStep("quiz");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof Error ? error.message : "미니퀴즈를 불러오지 못했습니다.");
        setStep("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId, currentTarget?.nodeId, currentTarget?.presetQuestion?.question_id, shouldUseMockMiniQuiz]);

  const isMultiSelect = question?.question_type === "multi_select";

  function toggleChoice(choiceId) {
    const clickedChoice = choices.find((choice) => choice.id === choiceId);
    const unknownChoice = choices.find(isUnknownChoice);
    const isClickedUnknown = isUnknownChoice(clickedChoice);

    if (isClickedUnknown) {
      setSelectedIds((current) => (current.includes(choiceId) ? [] : [choiceId]));
      return;
    }

    if (isMultiSelect) {
      setSelectedIds((current) => {
        const currentWithoutUnknown = unknownChoice
          ? current.filter((id) => id !== unknownChoice.id)
          : current;

        return currentWithoutUnknown.includes(choiceId)
          ? currentWithoutUnknown.filter((id) => id !== choiceId)
          : [...currentWithoutUnknown, choiceId];
      });
    } else {
      setSelectedIds([choiceId]);
    }
  }

  async function handleSubmit({ skipped = false } = {}) {
    if (!question) return;

    const selectedOptionIds = choices
      .filter((choice) => selectedIds.includes(choice.id))
      .map((choice) => choice.optionId)
      .filter(Boolean);

    setLoadingReason("submit");
    setStep("loading");
    try {
      if (isMiniQuizBackendApiEnabled && !shouldUseMockMiniQuiz) {
        const nextPendingBackendAnswers = [
          ...pendingBackendAnswers,
          {
            currentTarget,
            question,
            choices,
            selectedOptionIds: skipped ? [] : selectedOptionIds,
            isSkipped: skipped,
          },
        ];

        setPendingBackendAnswers(nextPendingBackendAnswers);

        if (isLastInQueue) {
          const nextSubmittedResults = await submitBackendAnswerGroups(nextPendingBackendAnswers);
          setSubmittedResults(nextSubmittedResults);
          completeQuiz(nextSubmittedResults);
          return;
        }

        setCurrentIndex((current) => current + 1);
        return;
      }

      const data = await delay(MOCK_LATENCY_MS).then(() =>
        buildMockMiniQuizAnswerResponse(getQuestionId(question), skipped ? [] : selectedOptionIds, skipped)
      );
      const reviewEntry = buildReviewEntry({
        question,
        choices,
        result: data,
        selectedOptionIds,
        currentTarget,
      });
      const nextSubmittedResults = [
        ...submittedResults,
        {
          currentTarget,
          question,
          choices,
          result: data,
          selectedOptionIds: reviewEntry.selected_option_ids,
          reviewEntry,
        },
      ];

      setSubmittedResults(nextSubmittedResults);

      if (isLastInQueue) {
        completeQuiz(nextSubmittedResults);
        return;
      }

      setCurrentIndex((current) => current + 1);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "미니퀴즈 제출에 실패했습니다.");
      setStep("error");
    }
  }

  const currentAnswer = submittedResults[answerIndex] || null;
  const isLastAnswer = answerIndex >= submittedResults.length - 1;
  const answerVerdictLabel = currentAnswer?.result?.is_fully_correct ? "정답" : "오답";
  const answerVerdictTone = currentAnswer?.result?.is_fully_correct ? "correct" : "wrong";
  const displayCurrentNumber =
    step === "answers"
      ? answerIndex + 1
      : step === "complete"
        ? submittedResults.length || totalCount
        : Math.min(visibleQuestionIndex + 1, totalCount || 1);
  const displayTotalNumber = step === "answers" || step === "complete" ? submittedResults.length || totalCount : totalCount;
  const resultSummaries = useMemo(() => {
    const summaryByNode = new Map();

    submittedResults.forEach((entry) => {
      const backendResult = entry.backendResult || entry.result || {};
      const updatedNode = backendResult.updated_node || backendResult.group_result?.updated_node || null;
      const nodeId = updatedNode?.node_id || entry.currentTarget?.nodeId || entry.reviewEntry?.concept_id;
      if (!nodeId || summaryByNode.has(nodeId)) {
        return;
      }

      summaryByNode.set(nodeId, {
        nodeId,
        name: backendResult.group_result?.node_name || entry.currentTarget?.name || entry.conceptName || "이 개념",
        groupScore: backendResult.group_score ?? backendResult.group_result?.group_score ?? null,
        answerScore: backendResult.answer_score ?? null,
        updatedNode,
        resultMessage: backendResult.result_message?.ai_response || null,
      });
    });

    return Array.from(summaryByNode.values());
  }, [submittedResults]);

  return (
    <div className="mini-quiz-popup-backdrop" role="dialog" aria-modal="true" aria-label="미니 퀴즈">
      <div className="mini-quiz-popup-card">
        <header className="mini-quiz-popup-head">
          <div className="mini-quiz-popup-title-wrap">
            <strong>미니 퀴즈</strong>
            {step === "answers" && currentAnswer ? (
              <span className={`mini-quiz-popup-verdict mini-quiz-popup-verdict-${answerVerdictTone}`}>
                {answerVerdictLabel}
              </span>
            ) : null}
          </div>
          <span className="mini-quiz-popup-progress">
            {displayCurrentNumber} / {displayTotalNumber}
          </span>
          <button type="button" className="mini-quiz-popup-close" onClick={handleClose} aria-label="닫기">
            <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="none" aria-hidden="true">
              <path
                fill="currentColor"
                d="M12.78 4.28a.75.75 0 00-1.06-1.06L8 6.94 4.28 3.22a.75.75 0 00-1.06 1.06L6.94 8l-3.72 3.72a.75.75 0 101.06 1.06L8 9.06l3.72 3.72a.75.75 0 101.06-1.06L9.06 8l3.72-3.72z"
              />
            </svg>
          </button>
        </header>

        {step === "loading" && loadingReason === "question" ? <MiniQuizQuestionLoadingOverlay /> : null}

        {step === "loading" && loadingReason === "submit" ? (
          <div className="mini-quiz-popup-body mini-quiz-popup-loading">
            <p>답안을 제출하고 결과를 정리하고 있어요…</p>
          </div>
        ) : null}

        {step === "error" ? (
          <div className="mini-quiz-popup-body mini-quiz-popup-error">
            <p>{errorMessage || "오류가 발생했습니다."}</p>
            <button type="button" className="mini-quiz-popup-action" onClick={handleClose}>
              닫기
            </button>
          </div>
        ) : null}

        {step === "quiz" && question ? (
          <div className="mini-quiz-popup-body">
            <MarkdownContent content={question.question} className="mini-quiz-popup-question" />
            <div className="mini-quiz-popup-choices">
              {choices.map((choice, index) => (
                <button
                  key={choice.id}
                  type="button"
                  className={`mini-quiz-popup-choice mini-quiz-popup-choice-with-index ${
                    selectedIds.includes(choice.id) ? "mini-quiz-popup-choice-active" : ""
                  }`}
                  onClick={() => toggleChoice(choice.id)}
                >
                  <span className="mini-quiz-popup-choice-index">{String.fromCharCode(65 + index)}</span>
                  <MarkdownContent content={choice.label} className="mini-quiz-popup-choice-text" />
                </button>
              ))}
            </div>
            <div className="mini-quiz-popup-actions">
              <button
                type="button"
                className="mini-quiz-popup-action mini-quiz-popup-action-secondary"
                onClick={() => handleSubmit({ skipped: true })}
              >
                잘 모르겠어요
              </button>
              <button
                type="button"
                className="mini-quiz-popup-action mini-quiz-popup-action-primary"
                onClick={() => handleSubmit()}
                disabled={!selectedIds.length}
              >
                제출하기
              </button>
            </div>
          </div>
        ) : null}

        {step === "complete" ? (
          <div className="mini-quiz-popup-body">
            <h2 className="mini-quiz-popup-question">퀴즈를 모두 풀었어요.</h2>
            <p className="mini-quiz-popup-summary-copy">
              답안을 확인하거나 채팅으로 돌아갈 수 있습니다.
            </p>
            {resultSummaries.length ? (
              <div className="mini-quiz-popup-choices">
                {resultSummaries.map((summary) => (
                  <div key={summary.nodeId} className="mini-quiz-popup-choice mini-quiz-popup-choice-static">
                    <span>
                      {summary.name}
                      {summary.groupScore !== null
                        ? ` · 그룹 점수 ${Number(summary.groupScore).toFixed(2)}`
                        : summary.answerScore !== null
                          ? ` · 점수 ${Number(summary.answerScore).toFixed(2)}`
                          : ""}
                      {summary.updatedNode?.understanding_score !== undefined &&
                      summary.updatedNode?.understanding_score !== null
                        ? ` · 이해도 ${Number(summary.updatedNode.understanding_score).toFixed(2)}`
                        : ""}
                      {summary.updatedNode?.status ? ` · ${summary.updatedNode.status}` : ""}
                    </span>
                    {summary.resultMessage ? <small>{summary.resultMessage}</small> : null}
                  </div>
                ))}
              </div>
            ) : null}
            <div className="mini-quiz-popup-actions">
              <button
                type="button"
                className="mini-quiz-popup-action mini-quiz-popup-action-secondary"
                onClick={() => {
                  setAnswerIndex(0);
                  setStep("answers");
                }}
              >
                답안 보기
              </button>
              <button
                type="button"
                className="mini-quiz-popup-action mini-quiz-popup-action-primary"
                onClick={handleClose}
              >
                돌아가기
              </button>
            </div>
          </div>
        ) : null}

        {step === "answers" && currentAnswer ? (
          <div className="mini-quiz-popup-body">
            <section className="mini-quiz-popup-answer-item">
              <h3>
                {answerIndex + 1} / {submittedResults.length}.
              </h3>
              <MarkdownContent content={currentAnswer.question.question} />
              <div className="mini-quiz-popup-choices">
                {currentAnswer.choices.map((choice) => {
                  const correctOptionIds = Array.isArray(currentAnswer.result?.correct_option_ids)
                    ? currentAnswer.result.correct_option_ids
                    : [];
                  const selectedOptionIdsFromResult = Array.isArray(currentAnswer.result?.selected_option_ids)
                    ? currentAnswer.result.selected_option_ids
                    : currentAnswer.selectedOptionIds;
                  const isCorrect = choice.optionId && correctOptionIds.includes(choice.optionId);
                  const wasSelected = choice.optionId && selectedOptionIdsFromResult.includes(choice.optionId);
                  let tone = "";
                  if (isCorrect) tone = "mini-quiz-popup-choice-correct";
                  else if (wasSelected) tone = "mini-quiz-popup-choice-wrong";

                  return (
                    <div key={choice.id} className={`mini-quiz-popup-choice mini-quiz-popup-choice-static ${tone}`}>
                      <MarkdownContent content={choice.label} />
                      {wasSelected ? <span className="mini-quiz-popup-selected-check">✓</span> : null}
                    </div>
                  );
                })}
              </div>
              {currentAnswer.reviewEntry?.explanation ? (
                <MarkdownContent
                  content={currentAnswer.reviewEntry.explanation}
                  className="mini-quiz-popup-summary-markdown"
                />
              ) : null}
            </section>
            <div className="mini-quiz-popup-actions">
              {answerIndex > 0 ? (
                <button
                  type="button"
                  className="mini-quiz-popup-action mini-quiz-popup-action-secondary"
                  onClick={() => setAnswerIndex((current) => Math.max(0, current - 1))}
                >
                  이전 문제
                </button>
              ) : null}
              <button
                type="button"
                className="mini-quiz-popup-action mini-quiz-popup-action-primary"
                onClick={() => {
                  if (isLastAnswer) {
                    handleClose();
                    return;
                  }

                  setAnswerIndex((current) => Math.min(submittedResults.length - 1, current + 1));
                }}
              >
                {isLastAnswer ? "돌아가기" : "다음 문제 →"}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
