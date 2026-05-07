"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import {
  explanationStyleOptions,
  languageOptions,
  learningTypeOptions,
} from "@/data/mockMyPageData";
import type { ProfileInfo } from "@/types/profile";

interface ProfileEditModalProps {
  open: boolean;
  profile: ProfileInfo;
  onClose: () => void;
  onSave: (nextProfile: ProfileInfo) => void;
}

function isSameProfile(a: ProfileInfo, b: ProfileInfo) {
  return JSON.stringify(a) === JSON.stringify(b);
}

interface DropdownOption<Value extends string> {
  value: Value;
  label: string;
}

interface ProfileDropdownProps<Value extends string> {
  value: Value;
  options: DropdownOption<Value>[];
  ariaLabel: string;
  onChange: (value: Value) => void;
}

function ProfileDropdown<Value extends string>({
  value,
  options,
  ariaLabel,
  onChange,
}: ProfileDropdownProps<Value>) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <div
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex h-9 w-full items-center justify-between rounded-[9px] bg-[#3d3d43] px-4 text-left text-[13px] font-medium text-[#d7d7dc] outline-none transition hover:bg-[#45454b] focus:ring-2 focus:ring-[#7c5cff]/45"
      >
        <span className="truncate">{selected?.label ?? value}</span>
        <span
          aria-hidden="true"
          className={`ml-3 text-[10px] text-[#9b9ba0] transition-transform ${open ? "rotate-180" : ""}`}
        >
          ▼
        </span>
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            role="listbox"
            className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 overflow-hidden rounded-[12px] bg-[#34353a] p-1 shadow-[0_18px_50px_rgba(0,0,0,0.32)]"
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.14, ease: "easeOut" }}
          >
            {options.map((option) => {
              const selectedOption = option.value === value;

              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={selectedOption}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-[9px] px-3 py-2 text-left text-[13px] transition ${
                    selectedOption
                      ? "bg-[#6f52d6] text-white"
                      : "text-[#c3c3c8] hover:bg-white/8 hover:text-white"
                  }`}
                >
                  <span className="truncate">{option.label}</span>
                  {selectedOption ? <span className="ml-3 text-[11px]">✓</span> : null}
                </button>
              );
            })}
          </motion.div>
        ) : null}
      </AnimatePresence>
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
      setDraft(profile);
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

  const isDirty = useMemo(() => !isSameProfile(draft, profile), [draft, profile]);

  function updateField<Key extends keyof ProfileInfo>(key: Key, value: ProfileInfo[Key]) {
    setDraft((current) => ({
      ...current,
      [key]: value,
    }));
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 py-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="프로필 수정"
            className="flex w-full max-w-[760px] flex-col rounded-[19px] bg-[#28292d] px-7 pb-5 pt-6 shadow-[0_30px_90px_rgba(0,0,0,0.42)]"
            initial={{ opacity: 0, scale: 0.97, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 12 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-7 flex items-start justify-between gap-4">
              <h2 className="text-[23px] font-bold leading-none text-white">프로필 수정</h2>
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[#5a5a60] text-xl leading-none text-white transition hover:bg-[#686870]"
                aria-label="프로필 수정 닫기"
              >
                ×
              </button>
            </div>

            <div className="grid gap-4">
              <label className="grid min-h-[44px] grid-cols-[104px_minmax(0,1fr)] items-center rounded-[9px] bg-[#505056] px-4">
                <span className="text-[14px] font-bold text-white">언어</span>
                <ProfileDropdown
                  value={draft.language}
                  options={languageOptions.map((language) => ({
                    value: language,
                    label: language,
                  }))}
                  ariaLabel="언어 선택"
                  onChange={(nextValue) => updateField("language", nextValue)}
                />
              </label>

              <div className="grid min-h-[44px] grid-cols-2 rounded-[9px] bg-[#505056] px-4">
                <label className="grid grid-cols-[104px_minmax(0,1fr)] items-center">
                  <span className="text-[14px] font-bold text-white">직업</span>
                  <input
                    type="text"
                    value={draft.job}
                    onChange={(event) => updateField("job", event.target.value)}
                    className="h-full w-full bg-transparent text-[14px] font-medium text-[#8d8d92] outline-none"
                  />
                </label>

                <label className="grid grid-cols-[84px_minmax(0,1fr)] items-center">
                  <span className="text-[14px] font-bold text-white">전공</span>
                  <input
                    type="text"
                    value={draft.major}
                    onChange={(event) => updateField("major", event.target.value)}
                    className="h-full w-full bg-transparent text-[14px] font-medium text-[#8d8d92] outline-none"
                  />
                </label>
              </div>

              <div className="grid gap-8 rounded-[9px] bg-[#505056] px-5 pb-6 pt-5 md:grid-cols-2">
                <label>
                  <span className="mb-3 block text-[13px] font-bold text-white">선호 설명 방식</span>
                  <ProfileDropdown
                    value={draft.explanationStyle}
                    options={explanationStyleOptions.map((option) => ({
                      value: option.value,
                      label: option.label,
                    }))}
                    ariaLabel="선호 설명 방식 선택"
                    onChange={(nextValue) => updateField("explanationStyle", nextValue)}
                  />
                </label>

                <label>
                  <span className="mb-3 block text-[13px] font-bold text-white">목표 학습 유형</span>
                  <ProfileDropdown
                    value={draft.learningType}
                    options={learningTypeOptions.map((option) => ({
                      value: option.value,
                      label: option.label,
                    }))}
                    ariaLabel="목표 학습 유형 선택"
                    onChange={(nextValue) => updateField("learningType", nextValue)}
                  />
                </label>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => onSave(draft)}
                disabled={!isDirty}
                className="rounded-full bg-[#6945c7] px-6 py-[10px] text-[13px] font-bold text-white transition hover:bg-[#7652d7] disabled:cursor-not-allowed disabled:bg-[#5a4a7a] disabled:text-white/55"
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
