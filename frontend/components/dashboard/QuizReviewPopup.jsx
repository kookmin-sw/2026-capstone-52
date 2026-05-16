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
              const tone = choice.is_correct
                ? "quiz-review-popup-choice-correct"
                : choice.is_selected
                  ? "quiz-review-popup-choice-wrong"
                  : "";
              return (
                <div key={choice.option_id || index} className={`quiz-review-popup-choice ${tone}`}>
                  <span className="quiz-review-popup-choice-index">{String.fromCharCode(65 + index)}</span>
                  <span className="quiz-review-popup-choice-text">{choice.text}</span>
                  <span className="quiz-review-popup-choice-tags">
                    {choice.is_correct ? (
                      <span className="quiz-review-popup-tag quiz-review-popup-tag-correct">정답</span>
                    ) : null}
                    {choice.is_selected && !choice.is_correct ? (
                      <span className="quiz-review-popup-tag quiz-review-popup-tag-wrong">내 답</span>
                    ) : null}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
