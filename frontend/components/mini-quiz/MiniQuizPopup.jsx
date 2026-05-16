"use client";

import { useEffect, useMemo, useState } from "react";
import EeumIcon from "@/components/common/EeumIcon";
import {
  generateApiMiniQuizQuestion,
  isMiniQuizBackendApiEnabled,
  submitApiMiniQuizAnswer,
} from "../../features/mini-quiz/api-service";
import { buildMockMiniQuizAnswerResponse, getMockMiniQuizQuestion } from "../../features/mini-quiz/mock-data";

const MOCK_LATENCY_MS = 380;
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

export default function MiniQuizPopup({
  projectId,
  conceptNodeId,
  conceptName,
  conceptQueue,
  onClose,
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

  const [currentIndex, setCurrentIndex] = useState(0);
  const [step, setStep] = useState("loading"); // loading | quiz | result | error
  const [question, setQuestion] = useState(null);
  const [choices, setChoices] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [result, setResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  const currentTarget = queue[currentIndex] || null;
  const totalCount = queue.length;
  const isLastInQueue = totalCount > 0 && currentIndex >= totalCount - 1;

  useEffect(() => {
    if (!projectId || !currentTarget) {
      return undefined;
    }

    let cancelled = false;
    setStep("loading");
    setSelectedIds([]);
    setResult(null);
    setErrorMessage("");

    (async () => {
      try {
        const data = isMiniQuizBackendApiEnabled
          ? await generateApiMiniQuizQuestion(projectId, currentTarget.nodeId)
          : await delay(MOCK_LATENCY_MS).then(() => getMockMiniQuizQuestion(currentTarget.nodeId));
        if (cancelled) return;
        const rawChoices = Array.isArray(data?.choices) ? data.choices : [];
        setQuestion(data);
        setChoices(rawChoices.map(normalizeChoice));
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
  }, [projectId, currentTarget?.nodeId]);

  const isMultiSelect = question?.question_type === "multi_select";

  function toggleChoice(choiceId) {
    if (isMultiSelect) {
      setSelectedIds((current) =>
        current.includes(choiceId) ? current.filter((id) => id !== choiceId) : [...current, choiceId]
      );
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

    setStep("loading");
    try {
      const data = isMiniQuizBackendApiEnabled
        ? await submitApiMiniQuizAnswer(projectId, question.question_id, {
            selectedOptionIds: skipped ? null : selectedOptionIds.length ? selectedOptionIds : null,
            isSkipped: skipped,
          })
        : await delay(MOCK_LATENCY_MS).then(() =>
            buildMockMiniQuizAnswerResponse(question.question_id, skipped ? [] : selectedOptionIds, skipped)
          );
      setResult(data);
      setStep("result");

      // 풀이 이력에 즉시 반영할 수 있도록 backend QuizQuestionReview 와 동일 shape로 전달.
      if (typeof onResult === "function" && currentTarget) {
        const correctSet = new Set(Array.isArray(data.correct_option_ids) ? data.correct_option_ids : []);
        const selectedFromResult = Array.isArray(data.selected_option_ids)
          ? data.selected_option_ids
          : selectedOptionIds;
        const selectedSet = new Set(selectedFromResult);
        const reviewEntry = {
          question_id: question.question_id,
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
          is_fully_correct: data.is_fully_correct ?? null,
          partial_score: data.partial_score ?? null,
          answer_score: data.answer_score ?? null,
          // 백엔드 QuizQuestionReview.source 와 동일 값 — 추후 백엔드 응답으로 대체될 수 있음.
          source: "mini_quiz",
        };
        onResult({
          nodeId: currentTarget.nodeId,
          conceptName: currentTarget.name,
          reviewEntry,
          resultMessage: data?.result_message || null,
        });
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "미니퀴즈 제출에 실패했습니다.");
      setStep("error");
    }
  }

  function handleAdvance() {
    if (isLastInQueue) {
      onClose?.();
      return;
    }
    setCurrentIndex((current) => current + 1);
  }

  const correctOptionIds = Array.isArray(result?.correct_option_ids) ? result.correct_option_ids : [];
  const selectedOptionIdsFromResult = Array.isArray(result?.selected_option_ids)
    ? result.selected_option_ids
    : [];

  return (
    <div className="mini-quiz-popup-backdrop" role="dialog" aria-modal="true" aria-label="미니 퀴즈">
      <div className="mini-quiz-popup-card">
        <header className="mini-quiz-popup-head">
          <div className="mini-quiz-popup-brand">
            <EeumIcon className="mini-quiz-popup-icon" />
            <strong>미니 퀴즈</strong>
            {currentTarget?.name ? (
              <span className="mini-quiz-popup-concept">{currentTarget.name}</span>
            ) : null}
            {totalCount > 1 ? (
              <span className="mini-quiz-popup-progress">
                {currentIndex + 1} / {totalCount}
              </span>
            ) : null}
          </div>
          <button type="button" className="mini-quiz-popup-close" onClick={onClose} aria-label="닫기">
            ×
          </button>
        </header>

        {step === "loading" ? (
          <div className="mini-quiz-popup-body mini-quiz-popup-loading">
            <p>문제를 준비하고 있어요…</p>
          </div>
        ) : null}

        {step === "error" ? (
          <div className="mini-quiz-popup-body mini-quiz-popup-error">
            <p>{errorMessage || "오류가 발생했습니다."}</p>
            <button type="button" className="mini-quiz-popup-action" onClick={onClose}>
              닫기
            </button>
          </div>
        ) : null}

        {step === "quiz" && question ? (
          <div className="mini-quiz-popup-body">
            <h2 className="mini-quiz-popup-question">{question.question}</h2>
            <div className="mini-quiz-popup-choices">
              {choices.map((choice, index) => (
                <button
                  key={choice.id}
                  type="button"
                  className={`mini-quiz-popup-choice ${
                    selectedIds.includes(choice.id) ? "mini-quiz-popup-choice-active" : ""
                  }`}
                  onClick={() => toggleChoice(choice.id)}
                >
                  <span className="mini-quiz-popup-choice-index">{String.fromCharCode(65 + index)}</span>
                  <span>{choice.label}</span>
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

        {step === "result" && result ? (
          <div className="mini-quiz-popup-body">
            <h2 className="mini-quiz-popup-question">
              {result.is_fully_correct ? "정답이에요! 🎉" : "다시 한 번 살펴봐요"}
            </h2>
            <div className="mini-quiz-popup-choices">
              {choices.map((choice) => {
                const isCorrect = choice.optionId && correctOptionIds.includes(choice.optionId);
                const wasSelected = choice.optionId && selectedOptionIdsFromResult.includes(choice.optionId);
                let tone = "";
                if (isCorrect) tone = "mini-quiz-popup-choice-correct";
                else if (wasSelected) tone = "mini-quiz-popup-choice-wrong";
                return (
                  <div key={choice.id} className={`mini-quiz-popup-choice mini-quiz-popup-choice-static ${tone}`}>
                    <span>{choice.label}</span>
                    {isCorrect ? <span className="mini-quiz-popup-tag">정답</span> : null}
                    {wasSelected && !isCorrect ? <span className="mini-quiz-popup-tag">선택</span> : null}
                  </div>
                );
              })}
            </div>
            <div className="mini-quiz-popup-actions">
              <button
                type="button"
                className="mini-quiz-popup-action mini-quiz-popup-action-primary"
                onClick={handleAdvance}
              >
                {isLastInQueue ? "채팅으로 돌아가기" : "다음 문제 →"}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
