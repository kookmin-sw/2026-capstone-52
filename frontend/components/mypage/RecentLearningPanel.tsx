"use client";

import type { RecentLearningRecord } from "@/types/profile";

function formatDate(dateString: string) {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}.${month}.${day}`;
}

interface RecentLearningPanelProps {
  records: RecentLearningRecord[];
}

export default function RecentLearningPanel({ records }: RecentLearningPanelProps) {
  return (
    <section className="flex min-h-0 flex-col rounded-[19px] bg-[#3f3f45] px-5 pb-5 pt-4">
      <div className="mb-[clamp(18px,3vh,32px)] flex items-center justify-between gap-3 border-b border-white/10 pb-3">
        <h3 className="text-[18px] font-bold text-white">최근 학습 기록</h3>
        <p className="text-[11px] text-[#9a9aa0]">최근 30일</p>
      </div>

      <div className="min-h-0 flex-1 space-y-[clamp(10px,1.55vh,14px)] overflow-y-auto pr-0">
        {records.map((record) => (
          <article
            key={record.id}
            className="group rounded-[12px] bg-[#505056] px-[14px] py-[15px] transition hover:bg-[#57575d]"
          >
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="h-[10px] w-[10px] shrink-0 rounded-full"
                style={{ backgroundColor: record.accentColor, color: record.accentColor }}
              />
              <div className="min-w-0 flex-1">
                <div className="min-w-0">
                  <span className="block text-[10px] font-semibold" style={{ color: record.accentColor }}>
                    {record.subject}
                  </span>
                </div>
                <p className="mt-1 truncate text-[14px] font-bold leading-none text-white">{record.nodeName}</p>
                <time className="mt-2 block text-[10px] text-[#a3a3a8]">{formatDate(record.updatedAt)}</time>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
