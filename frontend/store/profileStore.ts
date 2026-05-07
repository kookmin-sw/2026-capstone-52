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
      version: 3,
      storage: createJSONStorage(() => localStorage),
      migrate: (persistedState, version) => {
        const state = persistedState as Partial<ProfileStoreState>;

        if (version < 3 && state.profile?.name === "홍길동") {
          return {
            ...state,
            profile: defaultProfile,
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
      label: "언어",
      value: profile.language,
    },
  ];
}

export function getDashboardProfileSummary(profile: ProfileInfo) {
  return {
    displayName: profile.name,
    subtitle: `${profile.major} · ${profile.job}`,
  };
}
