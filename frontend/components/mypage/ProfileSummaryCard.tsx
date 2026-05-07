"use client";

import { ChangeEvent, useRef } from "react";
import ProfileAvatar from "@/components/profile/ProfileAvatar";
import StatsRow from "@/components/mypage/StatsRow";
import type { MyPageStats, ProfileBadge, ProfileInfo } from "@/types/profile";

interface ProfileSummaryCardProps {
  profile: ProfileInfo;
  profileImage: string | null;
  badges: ProfileBadge[];
  stats: MyPageStats;
  onImageChange: (file: File) => void;
}

export default function ProfileSummaryCard({
  profile,
  profileImage,
  badges,
  stats,
  onImageChange,
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
    <section className="min-h-[clamp(132px,17vh,168px)] rounded-[19px] bg-[#3f3f45] px-[clamp(18px,2vw,28px)] py-[clamp(16px,2.4vh,24px)]">
      <div className="grid h-full items-center gap-6 xl:grid-cols-[minmax(280px,0.88fr)_minmax(560px,1fr)]">
        <div className="min-w-0">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="group relative w-fit shrink-0 rounded-full border-2 border-[#825cff] bg-[#564976] p-0 transition hover:border-[#a287ff]"
              aria-label="프로필 이미지 변경"
            >
              {profileImage ? (
                <ProfileAvatar
                  name={profile.name}
                  image={profileImage}
                  size={96}
                  className="border border-[#825cff]/40"
                />
              ) : (
                <span className="flex h-[clamp(76px,11vh,104px)] w-[clamp(76px,11vh,104px)] items-center justify-center rounded-full text-[clamp(24px,3vw,30px)]">
                  👨‍💻
                </span>
              )}
              <span className="pointer-events-none absolute inset-x-4 bottom-3 rounded-full bg-black/55 px-3 py-1 text-xs font-medium text-zinc-100 opacity-0 transition group-hover:opacity-100">
                사진 변경
              </span>
            </button>

            <div className="min-w-0">
              <h2 className="text-[clamp(20px,1.8vw,23px)] font-bold leading-none text-white">{profile.name}</h2>
              <p className="mt-3 text-[clamp(12px,1vw,13px)] text-[#adadb2]">
                {profile.major} · {profile.job}
              </p>

              <div className="mt-4 flex flex-wrap gap-3">
                {badges.map((badge, index) => (
                  <span
                    key={badge.label}
                    className={`rounded-full px-3 py-2 text-[11px] font-semibold ${
                      index === 0
                        ? "bg-[#66549c] text-[#a987ff]"
                        : index === 1
                          ? "bg-[#435a72] text-[#75b7ff]"
                          : "bg-[#3e704f] text-[#65e08b]"
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
