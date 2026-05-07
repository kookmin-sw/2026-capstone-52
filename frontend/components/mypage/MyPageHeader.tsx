"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

interface MyPageHeaderProps {
  onOpenEdit: () => void;
}

export default function MyPageHeader({ onOpenEdit }: MyPageHeaderProps) {
  const router = useRouter();

  return (
    <header className="h-14 border-b border-black/10 bg-[#292a2e]">
      <div className="flex h-full w-full items-center justify-between px-4">
        <div className="flex items-center gap-7">
          <Link href="/" className="workspace-brand-link" aria-label="eeum 홈">
            <span className="workspace-brand-ring" />
            <span className="workspace-brand-node" />
          </Link>

          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="text-sm font-medium text-[#b9b9bd] transition hover:text-white"
          >
            ← 돌아가기
          </button>
        </div>

        <div className="flex items-center gap-12 pr-8">
          <button
            type="button"
            onClick={onOpenEdit}
            className="text-sm font-semibold text-white transition hover:text-[#bca7ff]"
          >
            프로필 수정
          </button>
          <button
            type="button"
            onClick={() => router.push("/login")}
            className="text-sm font-medium text-[#7f7f84] transition hover:text-white"
          >
            로그아웃
          </button>
        </div>
      </div>
    </header>
  );
}
