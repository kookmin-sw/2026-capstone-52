"use client";

import { useEffect } from "react";

export default function QuizReviewPopup({ entry, onClose }) {
  useEffect(() => {
    function handleKey(event) {
      if (event.key === "Escape") onClose?.();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  if (!entry) return null;

  const choices = Array.isArray(entry.choices) ? entry.choices : [];
  // 백엔드는 정답 truth를 correct_option_ids로 별도 제공 — choice.is_correct 만 의존하면 비어 보일 수 있어 보정.
  const correctIdSet = new Set(Array.isArray(entry.correct_option_ids) ? entry.correct_option_ids : []);

  function handleBackdropClick(event) {
    if (event.target === event.currentTarget) {
      onClose?.();
    }
  }

  return (
    <div
      className="quiz-review-popup-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="풀이 상세"
      onClick={handleBackdropClick}
    >
      <div className="quiz-review-popup-card">
        <div className="quiz-review-popup-body">
          <h2 className="quiz-review-popup-question">{entry.question}</h2>

          <div className="quiz-review-popup-choices">
            {choices.map((choice, index) => {
              const isCorrect = correctIdSet.has(choice.option_id) || choice.is_correct;
              const tone = isCorrect
                ? "quiz-review-popup-choice-correct"
                : choice.is_selected
                  ? "quiz-review-popup-choice-wrong"
                  : "";
              return (
                <div key={choice.option_id || index} className={`quiz-review-popup-choice ${tone}`}>
                  <span className="quiz-review-popup-choice-index">{String.fromCharCode(65 + index)}</span>
                  <span className="quiz-review-popup-choice-text">{choice.text}</span>
                  {choice.is_selected ? <span className="quiz-review-popup-selected-check">✓</span> : null}
                </div>
              );
            })}
        </div>
        </div>
      </div>
    </div>
  );
}
