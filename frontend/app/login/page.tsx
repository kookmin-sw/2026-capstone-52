"use client";

import Link from "next/link";
import { LandingGraphLayer } from "@/components/landing/landing-graph-layer";

function BrandMark() {
  return (
    <span className="relative inline-flex h-8 w-12 items-center" aria-hidden="true">
      <span className="absolute left-0 top-1/2 h-7 w-7 -translate-y-1/2 rounded-full border-[5px] border-[#6c63ff]" />
      <span className="absolute left-[25px] top-1/2 h-[4px] w-[10px] -translate-y-1/2 rounded-full bg-[#6c63ff]" />
      <span className="absolute left-[33px] top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-[#6c63ff]" />
    </span>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
      <path
        d="M21.805 12.23c0-.69-.062-1.354-.177-1.992H12v3.77h5.502a4.706 4.706 0 0 1-2.04 3.089v2.56h3.296c1.93-1.776 3.047-4.396 3.047-7.427Z"
        fill="#4285F4"
      />
      <path
        d="M12 22c2.76 0 5.075-.915 6.76-2.474l-3.296-2.56c-.915.612-2.086.974-3.464.974-2.66 0-4.915-1.796-5.72-4.21H2.87v2.642A9.996 9.996 0 0 0 12 22Z"
        fill="#34A853"
      />
      <path
        d="M6.28 13.73A5.997 5.997 0 0 1 5.96 12c0-.6.11-1.182.32-1.73V7.628H2.87A9.995 9.995 0 0 0 2 12c0 1.61.386 3.135 1.07 4.372l3.21-2.642Z"
        fill="#FBBC05"
      />
      <path
        d="M12 6.06c1.5 0 2.847.516 3.907 1.53l2.93-2.93C17.07 3.01 14.756 2 12 2A9.996 9.996 0 0 0 2.87 7.628l3.41 2.642c.805-2.414 3.06-4.21 5.72-4.21Z"
        fill="#EA4335"
      />
    </svg>
  );
}

export default function LoginPage() {
  const handleGoogleSignIn = () => {
    console.log("Google sign-in clicked");
  };

  return (
    <main className="min-h-screen bg-[#2f3136] text-white">
      <section className="grid min-h-screen lg:grid-cols-[38fr_62fr]">
        <div className="relative overflow-hidden bg-[#202226] px-8 py-8 sm:px-10 sm:py-10 lg:px-16 lg:py-14">
          <Link
            href="/"
            className="inline-flex items-center gap-2 transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8f86ff] focus-visible:ring-offset-2 focus-visible:ring-offset-[#202226]"
          >
            <BrandMark />
            <span className="text-[1.7rem] font-semibold tracking-[-0.05em] text-[#6c63ff]">이음</span>
          </Link>

          <div className="relative z-10 mt-20 w-full max-w-[640px] lg:mt-[20vh]">
            <h1 className="text-[2.5rem] font-medium leading-[1.22] tracking-[-0.065em] text-[#f6f6f7] sm:text-[3.2rem] lg:text-[3.8rem]">
              <span className="block whitespace-nowrap">나에게 맞게 설명하고</span>
              <span className="block whitespace-nowrap">배움을 그래프로 잇는</span>
              <span className="block whitespace-nowrap">AI 튜터</span>
            </h1>
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-0 top-[36%] hidden overflow-hidden lg:block">
            <LandingGraphLayer staticMode reduced className="opacity-[0.96]" />
          </div>
        </div>

        <div className="flex items-center justify-center bg-[#2f3136] px-6 py-10 sm:px-8 lg:px-16">
          <div className="w-full max-w-[500px] rounded-[30px] bg-[#26282d] px-10 py-11 shadow-[0_18px_42px_rgba(8,9,11,0.14)] sm:px-12 sm:py-12">
            <div className="mx-auto flex max-w-[410px] flex-col">
              <header>
                <h2 className="text-[2.5rem] font-bold tracking-[-0.05em] text-white sm:text-[2.7rem]">로그인</h2>
                <p className="mt-3 text-[1.04rem] leading-7 text-[#d2d3d8]/50">
                  이음과 함께 맞춤 학습을 시작하세요
                </p>
              </header>

              <div className="mt-7 h-[1px] w-full bg-[#4a4b50]" />

              <button
                type="button"
                aria-label="Google 계정으로 로그인"
                onClick={handleGoogleSignIn}
                className="mt-8 inline-flex h-14 w-auto items-center justify-center gap-3 self-center rounded-full border border-white/12 bg-[#16181c] px-8 text-[1rem] font-semibold text-white shadow-[0_8px_18px_rgba(0,0,0,0.14)] transition hover:bg-[#1b1e23] active:translate-y-[1px] active:bg-[#121418] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8f86ff] focus-visible:ring-offset-2 focus-visible:ring-offset-[#26282d]"
              >
                <GoogleMark />
                <span>Sign in with Google</span>
              </button>

              <div className="mt-8 rounded-[18px] bg-[#43454c] px-6 py-4 text-center text-[0.98rem] leading-7 text-white/60">
                <p>
                  별도의 아이디, 비밀번호 없이
                  <br />
                  구글 아이디로 간편하게 로그인할 수 있어요
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
