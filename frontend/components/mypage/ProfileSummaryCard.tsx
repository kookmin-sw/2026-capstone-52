"use client";

import { ChangeEvent, useRef } from "react";
import StatsRow from "@/components/mypage/StatsRow";
import type { MyPageStats, ProfileBadge, ProfileInfo } from "@/types/profile";

interface ProfileSummaryCardProps {
  profile: ProfileInfo;
  profileImage: string | null;
  badges: ProfileBadge[];
  stats: MyPageStats;
  onImageChange: (file: File) => void;
  onOpenGraph: () => void;
}

export default function ProfileSummaryCard({
  profile,
  profileImage,
  badges,
  stats,
  onImageChange,
  onOpenGraph,
}: ProfileSummaryCardProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

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
              className="group relative w-fit shrink-0 rounded-[1.65rem] p-0 transition hover:scale-[1.01]"
              aria-label="프로필 이미지 변경"
            >
              {profileImage ? (
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
              <span className="pointer-events-none absolute inset-x-3 bottom-3 rounded-full bg-black/45 px-3 py-1 text-xs font-bold text-white opacity-0 transition group-hover:opacity-100">
                사진 변경
              </span>
            </button>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-[2rem] font-black leading-none text-[#24213d]">{profile.name}</h2>
                <button
                  type="button"
                  onClick={onOpenGraph}
                  className="inline-flex h-8 items-center gap-2 rounded-[0.65rem] border border-[#ebe9f5] bg-white px-3 text-[0.72rem] font-black text-[#817cf2]"
                >
                  ⌘ 전체 그래프
                </button>
              </div>
              <p className="mt-3 text-[0.85rem] font-semibold text-[#74708b]">
                {profile.major} · {profile.job}
              </p>

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

        <StatsRow stats={stats} />
      </div>
    </section>
  );
}
