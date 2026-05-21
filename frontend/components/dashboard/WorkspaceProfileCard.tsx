"use client";

import Link from "next/link";
import ProfileAvatar from "@/components/profile/ProfileAvatar";
import { getDashboardProfileSummary, useProfileStore } from "@/store/profileStore";

export default function WorkspaceProfileCard() {
  const profile = useProfileStore((state) => state.profile);
  const profileImage = useProfileStore((state) => state.profileImage);
  const hydrated = useProfileStore((state) => state.hydrated);
  const summary = getDashboardProfileSummary(profile);

  return (
    <Link href="/mypage" className="workspace-profile-card" aria-label="마이페이지로 이동">
      <ProfileAvatar
        name={summary.displayName}
        image={hydrated ? profileImage : null}
        size={44}
        className="workspace-profile-avatar !bg-transparent"
      />
      <div className="min-w-0">
        <strong className="block truncate">{summary.displayName}</strong>
        <p className="truncate">마이페이지 →</p>
      </div>
    </Link>
  );
}
