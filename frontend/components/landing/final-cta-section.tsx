"use client";

import { useRouter } from "next/navigation";
import { hasGoogleLoginSession } from "@/features/api/session";

const isBackendApiEnabled = process.env.NEXT_PUBLIC_USE_BACKEND_API === "true";

export function FinalCtaSection() {
  const router = useRouter();

  const handleStartLearning = () => {
    if (!isBackendApiEnabled || hasGoogleLoginSession()) {
      router.push("/dashboard");
      return;
    }

    router.push("/login");
  };

  return (
    <section className="relative z-20 flex min-h-[420px] items-center justify-center overflow-hidden px-6 py-12 text-[#24213d]">
      <div className="relative mx-auto flex max-w-[760px] flex-col items-center rounded-[1.75rem] bg-white/94 px-8 py-12 text-center shadow-[0_30px_90px_rgba(42,38,73,0.08)] backdrop-blur md:px-12">
        <h2 className="text-[1.85rem] font-black leading-[1.3] tracking-normal text-[#24213d] md:text-[2.2rem]">
          지금 공부하는 자료로 바로 시작해보세요
        </h2>
        <p className="mt-5 text-[0.95rem] font-medium leading-7 text-[#74708b]">
          이음이 자료를 읽고, 나의 이해도를 확인하고, 필요한 설명을 이어드립니다.
        </p>
        <button
          type="button"
          onClick={handleStartLearning}
          className="mt-8 inline-flex min-h-12 items-center justify-center rounded-full bg-[#817cf2] px-8 text-[0.95rem] font-bold text-white shadow-[0_14px_30px_rgba(129,124,242,0.32)] transition hover:bg-[#716be8] active:translate-y-[1px]"
        >
          맞춤 학습 시작하기 <span className="ml-3 text-[1.1rem] leading-none">→</span>
        </button>
      </div>
    </section>
  );
}
