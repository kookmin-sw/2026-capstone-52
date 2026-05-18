"use client";

import { useEffect, useState } from "react";
import type { MyPageStats } from "@/types/profile";

type StatValueKey = "projectCount" | "totalChats" | "diagnosisCount" | "conceptCount";

const statConfig: Array<{
  key: StatValueKey;
  label: string;
  cappedLabel?: string;
  className: string;
  valueClassName: string;
}> = [
  {
    key: "projectCount",
    label: "진행 프로젝트",
    className: "bg-[#ebe8ff]",
    valueClassName: "text-[#817cf2]",
  },
  {
    key: "totalChats",
    label: "총 학습 횟수",
    cappedLabel: "최근 학습 횟수",
    className: "bg-[#ffe3d3]",
    valueClassName: "text-[#ff8a62]",
  },
  {
    key: "diagnosisCount",
    label: "진단 횟수",
    className: "bg-[#d9f7ea]",
    valueClassName: "text-[#60d3a7]",
  },
  {
    key: "conceptCount",
    label: "이해 개념",
    cappedLabel: "최근 이해 개념",
    className: "bg-[#d9eaff]",
    valueClassName: "text-[#72a9f6]",
  },
];

interface StatsRowProps {
  stats: MyPageStats;
}

const COUNT_UP_DURATION_MS = 3000;

function easeOutCubic(progress: number) {
  return 1 - Math.pow(1 - progress, 3);
}

function CountUpValue({ value, className }: { value: number | string; className: string }) {
  const numericValue = typeof value === "number" && Number.isFinite(value) ? value : null;
  const [displayValue, setDisplayValue] = useState(numericValue ?? value);

  useEffect(() => {
    if (numericValue === null) {
      setDisplayValue(value);
      return;
    }

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setDisplayValue(numericValue);
      return;
    }

    let animationFrame = 0;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / COUNT_UP_DURATION_MS, 1);
      const easedProgress = easeOutCubic(progress);

      setDisplayValue(Math.round(numericValue * easedProgress));

      if (progress < 1) {
        animationFrame = window.requestAnimationFrame(tick);
      }
    };

    setDisplayValue(0);
    animationFrame = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, [numericValue, value]);

  return <strong className={`text-[2.15rem] font-black leading-none ${className}`}>{displayValue}</strong>;
}

export default function StatsRow({ stats }: StatsRowProps) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {statConfig.map((item) => {
        const isCappedDetail = Boolean(stats.detailStatsAreCapped && item.cappedLabel);
        const label = isCappedDetail ? item.cappedLabel : item.label;
        const title = isCappedDetail ? `최근 ${stats.detailStatsLimit}개 프로젝트 기준` : undefined;

        return (
          <div
            key={item.key}
            className={`flex h-[104px] min-w-[136px] flex-col items-center justify-center rounded-[1.25rem] px-6 ${item.className}`}
          >
            <CountUpValue value={stats[item.key]} className={item.valueClassName} />
            <span className="mt-3 text-[0.72rem] font-black text-[#62607c]" title={title}>
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
