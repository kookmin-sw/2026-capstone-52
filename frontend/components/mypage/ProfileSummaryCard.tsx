"use client";

import { ChangeEvent, useRef } from "react";
import StatsRow, { StatsRowSkeleton } from "@/components/mypage/StatsRow";
import type { MyPageStats, ProfileBadge, ProfileInfo } from "@/types/profile";

interface ProfileSummaryCardProps {
  profile: ProfileInfo;
  profileImage: string | null;
  badges: ProfileBadge[];
  stats: MyPageStats | null;
  loading?: boolean;
  hasUnsavedProfileImage?: boolean;
  onImageChange: (file: File) => void;
  onOpenProfileEdit?: () => void;
  onOpenGraph: () => void;
}

export default function ProfileSummaryCard({
  profile,
  profileImage,
  badges,
  stats,
  loading = false,
  hasUnsavedProfileImage = false,
  onImageChange,
  onOpenProfileEdit,
  onOpenGraph,
}: ProfileSummaryCardProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const hasProfileContent = Boolean(profile.name || profile.major || profile.job || badges.length);
  const profileSubtitle = [profile.major, profile.job].filter(Boolean).join(" · ");

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    onImageChange(file);
    event.target.value = "";
  }

  return (
    <section className="rounded-[1.45rem] border border-[#ebe9f5] bg-white px-[clamp(32px,3vw,48px)] py-[clamp(28px,3vh,42px)] shadow-[0_24px_70px_rgba(42,38,73,0.06)]">
      <div className="grid items-center gap-9 xl:grid-cols-[minmax(420px,1fr)_minmax(600px,auto)]">
        <div className="min-w-0">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={loading || !hasProfileContent}
              className="group relative w-fit shrink-0 rounded-[1.65rem] p-0 transition hover:scale-[1.01] disabled:cursor-default disabled:hover:scale-100"
              aria-label="프로필 이미지 변경"
            >
              {loading || !hasProfileContent ? (
                <span className="block h-[7rem] w-[7rem] rounded-[1.8rem] bg-[#f0eefb]" aria-hidden="true" />
              ) : profileImage ? (
                <img
                  src={profileImage}
                  alt={`${profile.name} 프로필 이미지`}
                  className="h-[7rem] w-[7rem] rounded-[1.8rem] object-cover"
                />
              ) : (
                <span className="flex h-[7rem] w-[7rem] items-center justify-center rounded-[1.8rem] bg-gradient-to-br from-[#817cf2] to-[#ef8f79] text-[2.25rem] shadow-[0_16px_36px_rgba(129,124,242,0.18)]">
                  👨‍💻
                </span>
              )}
              {hasProfileContent ? (
                <span className="pointer-events-none absolute inset-x-3 bottom-3 rounded-full bg-black/45 px-3 py-1 text-xs font-bold text-white opacity-0 transition group-hover:opacity-100">
                  사진 변경
                </span>
              ) : null}
            </button>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                {loading ? (
                  <span className="h-8 w-36 rounded-full bg-[#f0eefb]" aria-hidden="true" />
                ) : profile.name ? (
                  <h2 className="text-[2rem] font-black leading-none text-[#24213d]">{profile.name}</h2>
                ) : null}
                <button
                  type="button"
                  onClick={onOpenGraph}
                  className="inline-flex h-8 items-center gap-2 rounded-[0.65rem] border border-[#ebe9f5] bg-white px-3 text-[0.72rem] font-black text-[#817cf2]"
                >
                  ⌘ 전체 그래프
                </button>
              </div>
              {loading ? (
                <span className="mt-4 block h-4 w-52 rounded-full bg-[#f0eefb]" aria-hidden="true" />
              ) : profileSubtitle ? (
                <p className="mt-3 text-[0.85rem] font-semibold text-[#74708b]">
                  {profileSubtitle}
                </p>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2.5">
                {badges.map((badge, index) => (
                  <span
                    key={badge.label}
                    className={`rounded-full px-3 py-2 text-[0.72rem] font-black ${
                      index === 0
                        ? "bg-[#ebe8ff] text-[#817cf2]"
                        : index === 1
                          ? "bg-[#ffe3d3] text-[#d86a3f]"
                          : "bg-[#d9f7ea] text-[#37a97a]"
                    }`}
                  >
                    {badge.value}
                  </span>
                ))}
                {hasUnsavedProfileImage ? (
                  <button
                    type="button"
                    onClick={onOpenProfileEdit}
                    className="rounded-full bg-[#fff4de] px-3 py-2 text-[0.72rem] font-black text-[#b87517] transition hover:bg-[#ffe8bd]"
                  >
                    이미지 변경사항 저장 필요
                  </button>
                ) : null}
                {loading ? (
                  <>
                    <span className="h-8 w-20 rounded-full bg-[#f0eefb]" aria-hidden="true" />
                    <span className="h-8 w-24 rounded-full bg-[#f0eefb]" aria-hidden="true" />
                    <span className="h-8 w-28 rounded-full bg-[#f0eefb]" aria-hidden="true" />
                  </>
                ) : null}
              </div>
            </div>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {stats ? <StatsRow stats={stats} /> : <StatsRowSkeleton />}
      </div>
    </section>
  );
}
