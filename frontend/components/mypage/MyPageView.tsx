"use client";

import { useEffect, useMemo, useState } from "react";
import AllKnowledgeGraphModal from "@/components/mypage/AllKnowledgeGraphModal";
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
  const [isAllGraphOpen, setIsAllGraphOpen] = useState(false);
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
    <div className="mypage-scroll-shell h-screen overflow-y-auto overflow-x-hidden bg-[#faf9ff] text-[#24213d]">
      <MyPageHeader onOpenEdit={() => setIsEditOpen(true)} />

      <main className="mx-auto grid min-h-[calc(100vh-76px)] w-full max-w-[min(86vw,2000px)] grid-rows-[auto_auto] gap-7 px-[clamp(28px,3vw,52px)] py-[clamp(38px,5vh,58px)]">
        <ProfileSummaryCard
          profile={profile}
          profileImage={hydrated ? profileImage : null}
          badges={badges}
          stats={stats}
          onImageChange={handleImageChange}
          onOpenGraph={() => setIsAllGraphOpen(true)}
        />

        <section className="min-h-0">
          <RecentLearningPanel records={recentRecords} />
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

      <AllKnowledgeGraphModal open={isAllGraphOpen} onClose={() => setIsAllGraphOpen(false)} />
    </div>
  );
}
