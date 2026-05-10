"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { defaultProfile, getExplanationStyleLabel, getLearningTypeLabel } from "@/data/mockMyPageData";
import type { ProfileBadge, ProfileInfo } from "@/types/profile";

interface ProfileStoreState {
  profile: ProfileInfo;
  profileImage: string | null;
  hydrated: boolean;
  setHydrated: (hydrated: boolean) => void;
  updateProfile: (nextProfile: ProfileInfo) => void;
  updateProfileImage: (profileImage: string | null) => void;
}

export const useProfileStore = create<ProfileStoreState>()(
  persist(
    (set) => ({
      profile: defaultProfile,
      profileImage: null,
      hydrated: false,
      setHydrated: (hydrated) => set({ hydrated }),
      updateProfile: (profile) => set({ profile }),
      updateProfileImage: (profileImage) => set({ profileImage }),
    }),
    {
      name: "eeum-profile-store",
      version: 5,
      storage: createJSONStorage(() => localStorage),
      migrate: (persistedState, version) => {
        const state = persistedState as Partial<ProfileStoreState>;

        if (version < 3 && state.profile?.name === "홍길동") {
          return {
            ...state,
            profile: defaultProfile,
          };
        }

        if (version < 4 && state.profile) {
          return {
            ...state,
            profile: {
              ...defaultProfile,
              ...state.profile,
              job: state.profile.job === "Frontend Engineer" ? defaultProfile.job : state.profile.job,
              major: state.profile.major === "컴퓨터공학과" ? defaultProfile.major : state.profile.major,
              learningGoal:
                "learningGoal" in state.profile && typeof state.profile.learningGoal === "string"
                  ? state.profile.learningGoal
                  : defaultProfile.learningGoal,
            },
          };
        }

        if (version < 5 && state.profile) {
          return {
            ...state,
            profile: {
              ...defaultProfile,
              ...state.profile,
              job: state.profile.job === "Frontend Engineer" ? defaultProfile.job : state.profile.job,
              major: state.profile.major === "컴퓨터공학과" ? defaultProfile.major : state.profile.major,
            },
          };
        }

        return state;
      },
      partialize: (state) => ({
        profile: state.profile,
        profileImage: state.profileImage,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    }
  )
);

export function getProfileBadges(profile: ProfileInfo): ProfileBadge[] {
  return [
    {
      label: "선호 설명",
      value: getExplanationStyleLabel(profile.explanationStyle),
    },
    {
      label: "학습 타입",
      value: getLearningTypeLabel(profile.learningType),
    },
    {
      label: "관심 분야",
      value: profile.learningGoal,
    },
  ];
}

export function getDashboardProfileSummary(profile: ProfileInfo) {
  return {
    displayName: profile.name,
    subtitle: `${profile.major} · ${profile.job}`,
  };
}
