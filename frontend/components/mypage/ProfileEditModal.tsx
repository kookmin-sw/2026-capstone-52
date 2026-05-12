"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { defaultProfile } from "@/data/mockMyPageData";
import type { ExplanationStyleId, ProfileInfo } from "@/types/profile";

interface ProfileEditModalProps {
  open: boolean;
  profile: ProfileInfo;
  onClose: () => void;
  onSave: (nextProfile: ProfileInfo) => void;
}

function normalizeProfile(profile: ProfileInfo): ProfileInfo {
  return {
    ...defaultProfile,
    ...profile,
    major: profile.major || defaultProfile.major,
    learningGoal: profile.learningGoal || defaultProfile.learningGoal,
  };
}

const modalExplanationOptions: Array<{ value: ExplanationStyleId; label: string }> = [
  { value: "example", label: "예시 중심" },
  { value: "concise", label: "개념 중심" },
  { value: "step", label: "단계별 중심" },
];

function OptionButtonGroup<Value extends string>({
  value,
  options,
  onChange,
}: {
  value: Value;
  options: Array<{ value: Value; label: string }>;
  onChange: (value: Value) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {options.map((option) => {
        const selected = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`h-14 rounded-[0.85rem] text-[0.98rem] font-black transition ${
              selected
                ? "border border-[#817cf2] bg-[#f0edff] text-[#817cf2]"
                : "border border-transparent bg-[#f3f1ff] text-[#62607c] hover:bg-[#ebe8ff]"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export default function ProfileEditModal({
  open,
  profile,
  onClose,
  onSave,
}: ProfileEditModalProps) {
  const [draft, setDraft] = useState<ProfileInfo>(profile);

  useEffect(() => {
    if (open) {
      setDraft(normalizeProfile(profile));
    }
  }, [open, profile]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  const canSave = draft.name.trim().length > 0;

  function updateField<Key extends keyof ProfileInfo>(key: Key, value: ProfileInfo[Key]) {
    setDraft((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function handleSave() {
    if (!canSave) {
      return;
    }

    onSave({
      ...draft,
      name: draft.name.trim(),
      learningGoal: draft.learningGoal.trim(),
    });
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-[#454353]/48 px-4 py-6 backdrop-blur-[9px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="프로필 수정"
            className="flex w-full max-w-[710px] flex-col rounded-[2rem] bg-white px-10 pb-10 pt-12 shadow-[0_34px_110px_rgba(42,38,73,0.20)] sm:px-[42px]"
            initial={{ opacity: 0, scale: 0.97, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 12 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-9 flex items-start justify-between gap-4">
              <h2 className="text-[1.75rem] font-black leading-none text-[#24213d]">프로필 수정</h2>
              <button
                type="button"
                onClick={onClose}
                className="-mt-2 flex h-11 w-11 items-center justify-center rounded-full bg-[#f3f1ff] text-[1.55rem] leading-none text-[#24213d] transition hover:bg-[#ebe8ff] hover:text-[#817cf2]"
                aria-label="프로필 수정 닫기"
              >
                ×
              </button>
            </div>

            <div className="grid gap-5">
              <div className="grid gap-x-5 gap-y-5 md:grid-cols-2">
                <label className="grid gap-2.5">
                  <span className="text-[0.92rem] font-black text-[#62607c]">닉네임</span>
                  <input
                    type="text"
                    value={draft.name}
                    onChange={(event) => updateField("name", event.target.value)}
                    className="h-[52px] rounded-[0.85rem] border-0 bg-[#f3f1ff] px-5 text-[1rem] font-black text-[#24213d] outline-none focus:ring-2 focus:ring-[#817cf2]/35"
                  />
                </label>

                <label className="grid gap-2.5">
                  <span className="text-[0.92rem] font-black text-[#62607c]">직업</span>
                  <input
                    type="text"
                    value={draft.job}
                    onChange={(event) => updateField("job", event.target.value)}
                    className="h-[52px] rounded-[0.85rem] border-0 bg-[#f3f1ff] px-5 text-[1rem] font-black text-[#24213d] outline-none focus:ring-2 focus:ring-[#817cf2]/35"
                  />
                </label>

                <label className="grid gap-2.5">
                  <span className="text-[0.92rem] font-black text-[#62607c]">전공</span>
                  <input
                    type="text"
                    value={draft.major}
                    onChange={(event) => updateField("major", event.target.value)}
                    className="h-[52px] rounded-[0.85rem] border-0 bg-[#f3f1ff] px-5 text-[1rem] font-black text-[#24213d] outline-none focus:ring-2 focus:ring-[#817cf2]/35"
                  />
                </label>

                <label className="grid gap-2.5">
                  <span className="text-[0.92rem] font-black text-[#62607c]">관심 분야</span>
                  <input
                    type="text"
                    value={draft.learningGoal}
                    onChange={(event) => updateField("learningGoal", event.target.value)}
                    placeholder="예: 컴퓨터공학"
                    className="h-[52px] rounded-[0.85rem] border-0 bg-[#f3f1ff] px-5 text-[1rem] font-black text-[#24213d] outline-none placeholder:text-[#aaa6c0] focus:ring-2 focus:ring-[#817cf2]/35"
                  />
                </label>
              </div>

              <div className="grid gap-2.5">
                <span className="text-[0.92rem] font-black text-[#62607c]">선호 설명 방식</span>
                <OptionButtonGroup
                  value={draft.explanationStyle}
                  options={modalExplanationOptions}
                  onChange={(nextValue) => updateField("explanationStyle", nextValue)}
                />
              </div>
            </div>

            <div className="mt-8 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="h-14 rounded-full border border-[#ebe9f5] bg-white px-9 text-[1rem] font-black text-[#24213d] shadow-[0_10px_26px_rgba(42,38,73,0.04)] transition hover:border-[#d8d3ff] hover:text-[#817cf2]"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!canSave}
                className="h-14 rounded-full bg-[#817cf2] px-9 text-[1rem] font-black text-white shadow-[0_16px_34px_rgba(129,124,242,0.28)] transition hover:bg-[#7370e6] disabled:cursor-not-allowed disabled:bg-[#d8d3ff] disabled:text-white"
              >
                저장
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
