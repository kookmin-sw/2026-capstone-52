"use client";

import { useRouter } from "next/navigation";

interface MyPageHeaderProps {
  onOpenEdit: () => void;
}

export default function MyPageHeader({ onOpenEdit }: MyPageHeaderProps) {
  const router = useRouter();

  return (
    <header className="h-[76px] border-b border-[#ebe9f5] bg-white">
      <div className="flex h-full w-full items-center justify-between px-10">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="inline-flex items-center gap-2 text-[0.9rem] font-bold text-[#62607c] transition hover:text-[#817cf2]"
          >
            ← 돌아가기
          </button>
          <span className="text-[#aaa6c0]">·</span>
          <h1 className="text-[1.02rem] font-black text-[#24213d]">마이페이지</h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenEdit}
            className="inline-flex h-10 items-center justify-center rounded-full border border-[#ebe9f5] bg-white px-5 text-[0.86rem] font-black text-[#24213d] shadow-[0_8px_22px_rgba(42,38,73,0.04)] transition hover:border-[#d8d3ff] hover:text-[#817cf2]"
          >
            프로필 수정
          </button>
          <button
            type="button"
            onClick={() => router.push("/login")}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[#ebe9f5] bg-white px-5 text-[0.86rem] font-black text-[#24213d] shadow-[0_8px_22px_rgba(42,38,73,0.04)] transition hover:border-[#d8d3ff] hover:text-[#817cf2]"
          >
            ↪
            로그아웃
          </button>
        </div>
      </div>
    </header>
  );
}
