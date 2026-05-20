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
import { getApiMyPageViewData, isMyPageBackendApiEnabled, saveApiProfile } from "@/features/mypage/service";
import { getProfileBadges, useProfileStore } from "@/store/profileStore";
import type { MyPageStats, ProfileInfo, RecentLearningRecord } from "@/types/profile";

const emptyProfile: ProfileInfo = {
  name: "",
  language: "한국어",
  job: "",
  major: "",
  explanationStyle: "example",
  learningType: "project",
  learningGoal: "",
};

type ApiLoadStatus = "loading" | "loaded" | "error";

export default function MyPageView() {
  const profile = useProfileStore((state) => state.profile);
  const profileImage = useProfileStore((state) => state.profileImage);
  const profileImageDirty = useProfileStore((state) => state.profileImageDirty);
  const updateProfile = useProfileStore((state) => state.updateProfile);
  const updateProfileImage = useProfileStore((state) => state.updateProfileImage);
  const setUserProfileImage = useProfileStore((state) => state.setUserProfileImage);
  const resetProfileImageDirty = useProfileStore((state) => state.resetProfileImageDirty);
  const hydrated = useProfileStore((state) => state.hydrated);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAllGraphOpen, setIsAllGraphOpen] = useState(false);
  const [apiStats, setApiStats] = useState<MyPageStats | null>(null);
  const [apiRecentRecords, setApiRecentRecords] = useState<RecentLearningRecord[] | null>(null);
  const [apiLoadStatus, setApiLoadStatus] = useState<ApiLoadStatus>(
    isMyPageBackendApiEnabled ? "loading" : "loaded"
  );
  const [apiError, setApiError] = useState<string | null>(null);

  const isApiLoaded = !isMyPageBackendApiEnabled || apiLoadStatus === "loaded";
  const isApiLoading = isMyPageBackendApiEnabled && apiLoadStatus === "loading";
  const displayProfile = isApiLoaded ? profile : emptyProfile;
  const stats = useMemo(() => (isMyPageBackendApiEnabled ? apiStats : getMyPageStats()), [apiStats]);
  const badges = useMemo(() => getProfileBadges(profile), [profile]);
  const displayBadges = isApiLoaded ? badges : [];
  const recentRecords = useMemo(
    () => (isMyPageBackendApiEnabled ? apiRecentRecords || [] : getRecentLearningRecordsLast30Days(5)),
    [apiRecentRecords]
  );

  useEffect(() => {
    if (!isMyPageBackendApiEnabled) {
      return undefined;
    }

    let cancelled = false;

    async function loadApiData() {
      setApiLoadStatus("loading");
      setApiError(null);

      try {
        const data = await getApiMyPageViewData();

        if (cancelled) {
          return;
        }

        if (!data) {
          setApiLoadStatus("error");
          setApiError("마이페이지 정보를 불러오지 못했습니다.");
          return;
        }

        updateProfile(data.profile);
        updateProfileImage(data.profileImage);
        setApiStats(data.stats);
        setApiRecentRecords(data.recentRecords);
        setApiLoadStatus("loaded");
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setApiLoadStatus("error");
          setApiError("마이페이지 정보를 불러오지 못했습니다.");
        }
      }
    }

    loadApiData();

    return () => {
      cancelled = true;
    };
  }, [updateProfile, updateProfileImage]);

  function openProfileEdit() {
    if (!isApiLoaded) {
      return;
    }

    setIsEditOpen(true);
  }

  function handleImageChange(file: File) {
    const reader = new FileReader();

    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : null;

      if (result) {
        setUserProfileImage(result);
      }
    };

    reader.readAsDataURL(file);
  }

  return (
    <div className="mypage-scroll-shell h-screen overflow-y-auto overflow-x-hidden bg-[#faf9ff] text-[#24213d]">
      <MyPageHeader onOpenEdit={openProfileEdit} profileEditDisabled={!isApiLoaded} />

      <main className="mx-auto grid min-h-[calc(100vh-76px)] w-full max-w-[min(86vw,2000px)] grid-rows-[auto_auto] gap-7 px-[clamp(28px,3vw,52px)] py-[clamp(38px,5vh,58px)]">
        <ProfileSummaryCard
          profile={displayProfile}
          profileImage={isApiLoaded && hydrated ? profileImage : null}
          badges={displayBadges}
          stats={stats}
          loading={isApiLoading}
          hasUnsavedProfileImage={isApiLoaded && profileImageDirty}
          onImageChange={handleImageChange}
          onOpenProfileEdit={openProfileEdit}
          onOpenGraph={() => setIsAllGraphOpen(true)}
        />

        <section className="min-h-0">
          <RecentLearningPanel records={recentRecords} loading={isApiLoading} error={apiError} />
        </section>
      </main>

      <ProfileEditModal
        open={isEditOpen}
        profile={profile}
        onClose={() => setIsEditOpen(false)}
        onSave={async (nextProfile) => {
          const savedProfile = await saveApiProfile(nextProfile, profileImage, {
            includeProfileImage: profileImageDirty,
          });
          updateProfile(savedProfile);
          resetProfileImageDirty();
          setIsEditOpen(false);
        }}
      />

      <AllKnowledgeGraphModal open={isAllGraphOpen} onClose={() => setIsAllGraphOpen(false)} />
    </div>
  );
}
