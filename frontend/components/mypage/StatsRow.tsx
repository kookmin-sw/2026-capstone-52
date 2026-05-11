"use client";

import type { MyPageStats } from "@/types/profile";

const statConfig: Array<{ key: keyof MyPageStats; label: string; className: string; valueClassName: string }> = [
  {
    key: "projectCount",
    label: "진행 프로젝트",
    className: "bg-[#ebe8ff]",
    valueClassName: "text-[#817cf2]",
  },
  {
    key: "totalChats",
    label: "총 학습 횟수",
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
    className: "bg-[#d9eaff]",
    valueClassName: "text-[#72a9f6]",
  },
];

interface StatsRowProps {
  stats: MyPageStats;
}

export default function StatsRow({ stats }: StatsRowProps) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {statConfig.map((item) => (
        <div
          key={item.key}
          className={`flex h-[104px] min-w-[136px] flex-col items-center justify-center rounded-[1.25rem] px-6 ${item.className}`}
        >
          <strong className={`text-[2.15rem] font-black leading-none ${item.valueClassName}`}>{stats[item.key]}</strong>
          <span className="mt-3 text-[0.72rem] font-black text-[#62607c]">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
