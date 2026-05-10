"use client";

import EeumIcon from "@/components/common/EeumIcon";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { loginWithGoogleProfile } from "@/features/api/session";

const GOOGLE_IDENTITY_SCRIPT_SRC = "https://accounts.google.com/gsi/client";
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

type GoogleTokenClient = {
  requestAccessToken: (options?: { prompt?: string }) => void;
};

type GoogleUserInfo = {
  email?: string;
  name?: string;
  picture?: string;
};

type GoogleTokenResponse = {
  access_token?: string;
  error?: string;
};

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
  const router = useRouter();
  const tokenClientRef = useRef<GoogleTokenClient | null>(null);
  const [isGoogleReady, setIsGoogleReady] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      setLoginError("Google Client ID가 설정되지 않았습니다.");
      return undefined;
    }

    let cancelled = false;

    function initializeGoogleLogin() {
      const google = (window as any).google;

      if (!google?.accounts?.oauth2 || cancelled) {
        return;
      }

      tokenClientRef.current = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: "openid email profile",
        callback: async (response: GoogleTokenResponse) => {
          if (response.error || !response.access_token) {
            setIsSigningIn(false);
            setLoginError("Google 로그인에 실패했습니다.");
            return;
          }

          try {
            const profileResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
              headers: {
                Authorization: `Bearer ${response.access_token}`,
              },
            });

            if (!profileResponse.ok) {
              throw new Error("Google 사용자 정보를 불러오지 못했습니다.");
            }

            const profile = (await profileResponse.json()) as GoogleUserInfo;

            if (!profile.email) {
              throw new Error("Google 계정 이메일을 확인하지 못했습니다.");
            }

            await loginWithGoogleProfile({
              email: profile.email,
              nickname: profile.name || profile.email.split("@")[0],
              profile_image: profile.picture || null,
            });

            router.push("/dashboard");
          } catch (error) {
            setLoginError(error instanceof Error ? error.message : "로그인 처리 중 오류가 발생했습니다.");
          } finally {
            setIsSigningIn(false);
          }
        },
      });

      setIsGoogleReady(true);
      setLoginError(null);
    }

    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${GOOGLE_IDENTITY_SCRIPT_SRC}"]`);

    if (existingScript) {
      initializeGoogleLogin();
      return () => {
        cancelled = true;
      };
    }

    const script = document.createElement("script");
    script.src = GOOGLE_IDENTITY_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = initializeGoogleLogin;
    script.onerror = () => {
      if (!cancelled) {
        setLoginError("Google 로그인 스크립트를 불러오지 못했습니다.");
      }
    };
    document.head.appendChild(script);

    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleGoogleSignIn = () => {
    setLoginError(null);

    if (!GOOGLE_CLIENT_ID) {
      setLoginError("Google Client ID가 설정되지 않았습니다.");
      return;
    }

    if (!tokenClientRef.current) {
      setLoginError("Google 로그인을 아직 준비 중입니다.");
      return;
    }

    setIsSigningIn(true);
    tokenClientRef.current.requestAccessToken({ prompt: "select_account" });
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#fbfbff] text-[#24213d]">
      <div
        className="absolute inset-0"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(circle 42rem at 13% 14%, rgba(129, 124, 242, 0.17), transparent 62%), radial-gradient(circle 46rem at 84% 80%, rgba(255, 187, 152, 0.31), transparent 62%), radial-gradient(circle 42rem at 55% 104%, rgba(183, 244, 226, 0.46), transparent 60%), linear-gradient(180deg, #fbfbff 0%, #ffffff 100%)",
        }}
      />

      <Link
        href="/"
        className="absolute left-8 top-7 z-20 inline-flex items-center gap-3 transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#817cf2] focus-visible:ring-offset-2 focus-visible:ring-offset-[#fbfbff] md:left-14"
      >
        <EeumIcon className="h-9 w-9 shrink-0" />
        <span className="text-[1.45rem] font-black tracking-normal text-[#24213d]">이음</span>
      </Link>

      <section className="relative z-10 mx-auto grid min-h-screen max-w-[1320px] items-center gap-20 px-6 py-24 md:px-10 lg:grid-cols-[1.02fr_0.98fr] xl:gap-28">
        <div className="mx-auto w-full max-w-[620px] text-center lg:mx-0 lg:text-left">
          <h1 className="text-[3.2rem] font-[950] leading-[1.18] tracking-normal text-[#24213d] md:text-[4rem]">
            나에게 맞게 설명하고
            <br />
            배움을{" "}
            <span className="bg-gradient-to-r from-[#817cf2] to-[#8f8af7] bg-clip-text text-transparent">
              그래프로 잇는
            </span>
            <br />
            AI 튜터
          </h1>
          <p className="mt-8 text-[1.18rem] font-medium leading-9 text-[#74708b]">
            이음과 함께 맞춤 학습을 시작하세요.
            <br />
            지식이 그래프로 연결되는 새로운 학습 경험.
          </p>
        </div>

        <div className="mx-auto w-full max-w-[520px] rounded-[1.65rem] border border-[#e8e5f2] bg-white px-12 py-12 shadow-[0_30px_90px_rgba(42,38,73,0.1)]">
          <header>
            <p className="inline-flex items-center gap-2.5 text-[0.9rem] font-black text-[#817cf2]">
              <span className="h-2 w-2 rounded-full bg-[#817cf2]" />
              SIGN IN
            </p>
            <h2 className="mt-4 text-[2rem] font-black tracking-normal text-[#24213d]">로그인</h2>
            <p className="mt-5 text-[1.05rem] font-medium leading-7 text-[#74708b]">
              이음과 함께 맞춤 학습을 시작하세요.
              <br />
              별도의 아이디·비밀번호 없이 구글로 간편하게.
            </p>
          </header>

          <button
            type="button"
            aria-label="Google 계정으로 로그인"
            onClick={handleGoogleSignIn}
            disabled={!isGoogleReady || isSigningIn}
            className="mt-10 inline-flex h-14 w-full items-center justify-center gap-3.5 rounded-[1rem] border border-[#e8e5f2] bg-white px-6 text-[1.05rem] font-black text-[#24213d] shadow-[0_12px_30px_rgba(42,38,73,0.04)] transition hover:border-[#d5d0f3] hover:bg-[#fbfbff] active:translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#817cf2] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            <GoogleMark />
            <span>{isSigningIn ? "로그인 중..." : "Google로 계속하기"}</span>
          </button>

          {loginError ? (
            <p className="mt-5 text-center text-[0.95rem] leading-7 text-[#e35d5d]">{loginError}</p>
          ) : null}

          <p className="mt-8 text-center text-[0.88rem] font-medium leading-7 text-[#aaa6c0]">
            로그인하면 이음의{" "}
            <a href="#" className="font-bold text-[#817cf2] hover:text-[#716be8]">
              이용약관
            </a>
            과
            <br />
            <a href="#" className="font-bold text-[#817cf2] hover:text-[#716be8]">
              개인정보 처리방침
            </a>
            에 동의하게 됩니다.
          </p>

          <Link
            href="/"
            className="mt-8 flex justify-center text-[0.98rem] font-bold text-[#74708b] transition hover:text-[#817cf2]"
          >
            ← 돌아가기
          </Link>
        </div>
      </section>
    </main>
  );
}
