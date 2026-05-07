"use client";

import { useEffect, useMemo, useState } from "react";
import GalaxyGraphPanel from "@/components/mypage/GalaxyGraphPanel";
import MyPageHeader from "@/components/mypage/MyPageHeader";
import ProfileEditModal from "@/components/mypage/ProfileEditModal";
import ProfileSummaryCard from "@/components/mypage/ProfileSummaryCard";
import RecentLearningPanel from "@/components/mypage/RecentLearningPanel";
import {
  getMyPageStats,
  getRecentLearningRecordsLast30Days,
} from "@/data/mockMyPageData";
import { getApiMyPageViewData, saveApiProfile } from "@/features/mypage/service";
import { getProfileBadges, useProfileStore } from "@/store/profileStore";
import type { MyPageStats, RecentLearningRecord } from "@/types/profile";

export default function MyPageView() {
  const profile = useProfileStore((state) => state.profile);
  const profileImage = useProfileStore((state) => state.profileImage);
  const updateProfile = useProfileStore((state) => state.updateProfile);
  const updateProfileImage = useProfileStore((state) => state.updateProfileImage);
  const hydrated = useProfileStore((state) => state.hydrated);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [apiStats, setApiStats] = useState<MyPageStats | null>(null);
  const [apiRecentRecords, setApiRecentRecords] = useState<RecentLearningRecord[] | null>(null);

  const stats = useMemo(() => apiStats || getMyPageStats(), [apiStats]);
  const badges = useMemo(() => getProfileBadges(profile), [profile]);
  const recentRecords = useMemo(() => apiRecentRecords || getRecentLearningRecordsLast30Days(6), [apiRecentRecords]);

  useEffect(() => {
    let cancelled = false;

    async function loadApiData() {
      try {
        const data = await getApiMyPageViewData();

        if (!data || cancelled) {
          return;
        }

        updateProfile(data.profile);
        updateProfileImage(data.profileImage);
        setApiStats(data.stats);
        setApiRecentRecords(data.recentRecords);
      } catch (error) {
        console.error(error);
      }
    }

    loadApiData();

    return () => {
      cancelled = true;
    };
  }, [updateProfile, updateProfileImage]);

  function handleImageChange(file: File) {
    const reader = new FileReader();

    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : null;

      if (result) {
        updateProfileImage(result);
      }
    };

    reader.readAsDataURL(file);
  }

  return (
    <div className="h-screen overflow-hidden bg-[#303035] text-white">
      <MyPageHeader onOpenEdit={() => setIsEditOpen(true)} />

      <main className="mx-auto grid h-[calc(100vh-3.5rem)] w-full max-w-[100vw] grid-rows-[auto_minmax(0,1fr)] gap-[clamp(14px,2.6vh,24px)] px-[clamp(16px,2vw,29px)] py-[clamp(14px,2.6vh,24px)]">
        <ProfileSummaryCard
          profile={profile}
          profileImage={hydrated ? profileImage : null}
          badges={badges}
          stats={stats}
          onImageChange={handleImageChange}
        />

        <section className="grid min-h-0 gap-[clamp(14px,1.8vw,24px)] xl:grid-cols-[minmax(300px,31vw)_minmax(0,1fr)]">
          <RecentLearningPanel records={recentRecords} />
          <GalaxyGraphPanel />
        </section>
      </main>

      <ProfileEditModal
        open={isEditOpen}
        profile={profile}
        onClose={() => setIsEditOpen(false)}
        onSave={async (nextProfile) => {
          const savedProfile = await saveApiProfile(nextProfile, profileImage);
          updateProfile(savedProfile);
          setIsEditOpen(false);
        }}
      />
    </div>
  );
}
