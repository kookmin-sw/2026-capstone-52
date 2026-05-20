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
import {
  getApiMyPageViewData,
  isMyPageBackendApiEnabled,
  saveApiProfile,
} from "@/features/mypage/service";
import { getProfileBadges, useProfileStore } from "@/store/profileStore";
import type { MyPageStats, RecentLearningRecord } from "@/types/profile";

function MyPageStatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="flex h-[104px] min-w-[136px] flex-col items-center justify-center rounded-[1.25rem] bg-[#f0eefb] px-6"
        >
          <div className="h-8 w-14 animate-pulse rounded-full bg-[#dedbf0]" />
          <div className="mt-4 h-3 w-20 animate-pulse rounded-full bg-[#dedbf0]" />
        </div>
      ))}
    </div>
  );
}

function MyPageInitialLoadingState() {
  return (
    <>
      <section className="rounded-[1.45rem] border border-[#ebe9f5] bg-white px-[clamp(32px,3vw,48px)] py-[clamp(28px,3vh,42px)] shadow-[0_24px_70px_rgba(42,38,73,0.06)]">
        <div className="grid items-center gap-9 xl:grid-cols-[minmax(420px,1fr)_minmax(600px,auto)]">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="h-[7rem] w-[7rem] shrink-0 animate-pulse rounded-[1.8rem] bg-[#ebe9f5]" />
            <div className="min-w-0 flex-1">
              <div className="h-8 w-44 animate-pulse rounded-full bg-[#ebe9f5]" />
              <div className="mt-4 h-4 w-64 max-w-full animate-pulse rounded-full bg-[#f0eefb]" />
              <div className="mt-5 flex flex-wrap gap-2.5">
                <div className="h-8 w-24 animate-pulse rounded-full bg-[#ebe8ff]" />
                <div className="h-8 w-24 animate-pulse rounded-full bg-[#ffe3d3]" />
                <div className="h-8 w-28 animate-pulse rounded-full bg-[#d9f7ea]" />
              </div>
            </div>
          </div>
          <MyPageStatsSkeleton />
        </div>
      </section>

      <section className="min-h-0">
        <RecentLearningPanel records={[]} />
      </section>
    </>
  );
}

function MyPageUnavailableState() {
  return (
    <section className="grid min-h-[360px] place-items-center rounded-[1.45rem] border border-[#ebe9f5] bg-white px-8 py-12 text-center shadow-[0_24px_70px_rgba(42,38,73,0.06)]">
      <div>
        <h2 className="text-[1.35rem] font-black text-[#24213d]">프로필 정보를 불러오지 못했습니다.</h2>
        <p className="mt-3 text-[0.95rem] font-semibold text-[#74708b]">잠시 후 다시 시도해주세요.</p>
      </div>
    </section>
  );
}

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
  const [isApiLoading, setIsApiLoading] = useState(isMyPageBackendApiEnabled);
  const [apiLoadFailed, setApiLoadFailed] = useState(false);

  const stats = useMemo(
    () => (isMyPageBackendApiEnabled ? apiStats : apiStats || getMyPageStats()),
    [apiStats]
  );
  const badges = useMemo(() => getProfileBadges(profile), [profile]);
  const recentRecords = useMemo(
    () =>
      isMyPageBackendApiEnabled
        ? apiRecentRecords || []
        : apiRecentRecords || getRecentLearningRecordsLast30Days(5),
    [apiRecentRecords]
  );
  const shouldBlockProfileActions = isMyPageBackendApiEnabled && (isApiLoading || apiLoadFailed);

  useEffect(() => {
    let cancelled = false;

    async function loadApiData() {
      if (!isMyPageBackendApiEnabled) {
        return;
      }

      setIsApiLoading(true);
      setApiLoadFailed(false);

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
        if (!cancelled) {
          setApiLoadFailed(true);
        }
      } finally {
        if (!cancelled) {
          setIsApiLoading(false);
        }
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
        setUserProfileImage(result);
      }
    };

    reader.readAsDataURL(file);
  }

  return (
    <div className="mypage-scroll-shell h-screen overflow-y-auto overflow-x-hidden bg-[#faf9ff] text-[#24213d]">
      <MyPageHeader
        onOpenEdit={() => {
          if (!shouldBlockProfileActions) {
            setIsEditOpen(true);
          }
        }}
      />

      <main className="mx-auto grid min-h-[calc(100vh-76px)] w-full max-w-[min(86vw,2000px)] grid-rows-[auto_auto] gap-7 px-[clamp(28px,3vw,52px)] py-[clamp(38px,5vh,58px)]">
        {isApiLoading ? (
          <MyPageInitialLoadingState />
        ) : apiLoadFailed || !stats ? (
          <MyPageUnavailableState />
        ) : (
          <>
            <ProfileSummaryCard
              profile={profile}
              profileImage={hydrated ? profileImage : null}
              badges={badges}
              stats={stats}
              hasUnsavedProfileImage={profileImageDirty}
              onImageChange={handleImageChange}
              onOpenProfileEdit={() => setIsEditOpen(true)}
              onOpenGraph={() => setIsAllGraphOpen(true)}
            />

            <section className="min-h-0">
              <RecentLearningPanel records={recentRecords} />
            </section>
          </>
        )}
      </main>

      <ProfileEditModal
        open={isEditOpen && !shouldBlockProfileActions}
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
