"use client";

import EeumIcon from "@/components/common/EeumIcon";
import { hasGoogleLoginSession, logoutGoogleSession } from "@/features/api/session";
import { useEffect, useRef, useState } from "react";

const navItems = [
  { label: "서비스 소개", href: "#intro" },
  { label: "이용 방법", href: "#how-it-works" }
] as const;

const TOP_THRESHOLD = 8;
const HIDE_THRESHOLD = 80;

export function LandingNavbar() {
  const [scrollY, setScrollY] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [hasActiveGoogleSession, setHasActiveGoogleSession] = useState(false);
  const lastScrollYRef = useRef(0);

  useEffect(() => {
    const scrollRoot = document.getElementById("landing-scroll-root");

    function handleScroll() {
      const nextScrollY = scrollRoot ? scrollRoot.scrollTop : window.scrollY;
      const previousScrollY = lastScrollYRef.current;
      const delta = nextScrollY - previousScrollY;

      setScrollY(nextScrollY);

      if (nextScrollY <= HIDE_THRESHOLD) {
        setIsVisible(true);
      } else if (delta > 0) {
        setIsVisible(false);
      } else if (delta < 0) {
        setIsVisible(true);
      }

      lastScrollYRef.current = nextScrollY;
    }

    handleScroll();
    const target: HTMLElement | Window = scrollRoot || window;
    target.addEventListener("scroll", handleScroll, { passive: true });

    return () => target.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    function syncGoogleSession() {
      setHasActiveGoogleSession(hasGoogleLoginSession());
    }

    syncGoogleSession();
    window.addEventListener("storage", syncGoogleSession);
    window.addEventListener("eeum-auth-session-change", syncGoogleSession);

    return () => {
      window.removeEventListener("storage", syncGoogleSession);
      window.removeEventListener("eeum-auth-session-change", syncGoogleSession);
    };
  }, []);

  const handleLogout = () => {
    logoutGoogleSession();
    setHasActiveGoogleSession(false);
  };

  const isAtTop = scrollY <= TOP_THRESHOLD;
  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-transform duration-300 ease-out ${
        isVisible ? "translate-y-0" : "-translate-y-full"
      } ${
        isAtTop
          ? "border-b border-[#eceaf5] bg-white/72 backdrop-blur-xl"
          : "border-b border-[#e3e0ee] bg-white/92 shadow-[0_10px_30px_rgba(42,38,73,0.06)] backdrop-blur-xl"
      }`}
    >
      <div className="mx-auto flex h-[84px] w-full max-w-[1800px] items-center gap-6 px-6 md:px-12 xl:px-[4.7rem]">
        <a href="#hero" className="flex items-center gap-2.5">
          <EeumIcon className="h-8 w-8 shrink-0" />
          {/* 랜딩 페이지 공통 Navbar 브랜드명 "이음" 텍스트입니다. 크기/굵기는 아래 className에서 수정하세요. */}
          <span className="text-[1.3rem] font-black tracking-normal text-[#24213d]">
            이음
          </span>
        </a>

        <div className="ml-auto flex items-center gap-10">
          <nav aria-label="주요 메뉴" className="hidden items-center gap-14 md:flex">
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                /* 랜딩 페이지 상단 Navbar 메뉴 "서비스 소개/핵심 기능/이용 방법" 텍스트입니다. 크기/굵기는 아래 className에서 수정하세요. */
                className="text-[1rem] font-extrabold tracking-normal text-[#24213d] transition hover:text-[#817cf2]"
              >
                {item.label}
              </a>
            ))}
          </nav>

          {hasActiveGoogleSession ? (
            <button
              type="button"
              onClick={handleLogout}
              aria-label="로그아웃"
              /* 랜딩 페이지 상단 Navbar 로그아웃 버튼 "로그아웃" 텍스트입니다. 버튼 높이/가로폭/글자 크기는 아래 className에서 수정하세요. */
              className="inline-flex h-10 items-center justify-center rounded-full bg-[#817cf2] px-6 text-[0.95rem] font-bold text-white shadow-[0_12px_24px_rgba(129,124,242,0.24)] transition hover:bg-[#716be8]"
            >
              <span>로그아웃</span>
            </button>
          ) : (
            <a
              href="/login"
              aria-label="로그인 페이지로 이동"
              /* 랜딩 페이지 상단 Navbar 로그인 버튼 "로그인" 텍스트입니다. 버튼 높이/가로폭/글자 크기는 아래 className에서 수정하세요. */
              className="inline-flex h-10 items-center justify-center rounded-full bg-[#817cf2] px-6 text-[0.95rem] font-bold text-white shadow-[0_12px_24px_rgba(129,124,242,0.24)] transition hover:bg-[#716be8]"
            >
              <span>로그인</span>
            </a>
          )}
        </div>
      </div>
    </header>
  );
}
