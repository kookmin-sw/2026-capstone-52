"use client";

import type { MyPageStats } from "@/types/profile";

const statConfig: Array<{ key: keyof MyPageStats; label: string }> = [
  { key: "projectCount", label: "현재 프로젝트 수" },
  { key: "totalChats", label: "총 학습 횟수" },
  { key: "diagnosisCount", label: "진단 횟수" },
  { key: "conceptCount", label: "이해 개념" },
];

interface StatsRowProps {
  stats: MyPageStats;
}

export default function StatsRow({ stats }: StatsRowProps) {
  return (
    <div className="grid min-h-[96px] grid-cols-2 gap-0 lg:grid-cols-4">
      {statConfig.map((item, index) => (
        <div
          key={item.key}
          className={`flex flex-col items-center justify-center px-5 py-4 ${
            index < statConfig.length - 1 ? "lg:border-r lg:border-white/10" : ""
          }`}
        >
          <strong className="text-[clamp(24px,2.2vw,30px)] font-bold leading-none text-[#865cff]">{stats[item.key]}</strong>
          <span className="mt-4 text-[10px] text-[#8b8b91]">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
