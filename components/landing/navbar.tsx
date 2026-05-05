"use client";

import { useEffect, useRef, useState } from "react";

const navItems = [
  { label: "서비스 소개", href: "#intro" },
  { label: "핵심 기능", href: "#features" },
  { label: "이용 방법", href: "#how-it-works" },
  { label: "이용권 안내", href: undefined }
] as const;

const TOP_THRESHOLD = 8;
const HIDE_THRESHOLD = 80;

function BrandMark() {
  return (
    <span className="relative inline-flex h-7 w-10 items-center" aria-hidden="true">
      <span className="absolute left-0 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full border-[4px] border-[#6c63ff]" />
      <span className="absolute left-[21px] top-1/2 h-[4px] w-[8px] -translate-y-1/2 rounded-full bg-[#6c63ff]" />
      <span className="absolute left-[27px] top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full bg-[#6c63ff]" />
    </span>
  );
}

export function LandingNavbar() {
  const [scrollY, setScrollY] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
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

  const isAtTop = scrollY <= TOP_THRESHOLD;
  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-transform duration-300 ease-out ${
        isVisible ? "translate-y-0" : "-translate-y-full"
      } ${
        isAtTop
          ? "border-b border-transparent bg-transparent backdrop-blur-none"
          : "border-b border-white/8 bg-[#2A2B2E]/92 backdrop-blur-md"
      }`}
    >
      <div className="mx-auto flex h-[78px] w-full max-w-[1440px] items-center justify-between gap-6 px-6">
        <a href="#hero" className="flex items-center gap-2">
          <BrandMark />
          {/* 랜딩 페이지 공통 Navbar 브랜드명 "이음" 텍스트입니다. 크기/굵기는 아래 className에서 수정하세요. */}
          <span className="text-[1.6rem] font-semibold tracking-[-0.04em] text-[#6c63ff]">
            이음
          </span>
        </a>

        <nav aria-label="주요 메뉴" className="hidden items-center gap-16 md:flex">
          {navItems.map((item) =>
            item.href ? (
              <a
                key={item.label}
                href={item.href}
                /* 랜딩 페이지 상단 Navbar 메뉴 "서비스 소개/핵심 기능" 텍스트입니다. 크기/굵기는 아래 className에서 수정하세요. */
                className="text-[1.05rem] font-normal tracking-[-0.01em] text-white/88 transition hover:text-white"
              >
                {item.label}
              </a>
            ) : (
              <span
                key={item.label}
                /* 랜딩 페이지 상단 Navbar placeholder 메뉴 "이용 방법/이용권 안내" 텍스트입니다. 크기/굵기는 아래 className에서 수정하세요. */
                className="text-[1.05rem] font-normal tracking-[-0.01em] text-white/78"
              >
                {item.label}
              </span>
            )
          )}
        </nav>

        <a
          href="/login"
          aria-label="로그인 페이지로 이동"
          /* 랜딩 페이지 상단 Navbar 로그인 버튼 "로그인" 텍스트입니다. 버튼 높이/가로폭/글자 크기는 아래 className에서 수정하세요. */
          className="inline-flex h-12 items-center justify-center rounded-full bg-[#7c67ff] px-4 text-[0.9rem] font-normal text-white transition hover:bg-[#8d7aff]"
        >
          <span>로그인</span>
        </a>
      </div>
    </header>
  );
}
