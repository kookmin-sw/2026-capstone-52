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
  const visibleRecords = records.slice(0, 7);

  return (
    <section className="flex h-[clamp(780px,87vh,960px)] min-h-0 flex-col rounded-[1.45rem] border border-[#ebe9f5] bg-white px-[clamp(32px,3vw,48px)] py-[clamp(28px,3vh,40px)] shadow-[0_24px_70px_rgba(42,38,73,0.06)]">
      <div className="mb-7 flex items-center justify-between gap-3">
        <h3 className="text-[1.35rem] font-black text-[#24213d]">최근 학습 기록</h3>
        <p className="rounded-full bg-[#f3f1ff] px-4 py-2.5 text-[0.84rem] font-black text-[#74708b]">최근 30일</p>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-0">
        {visibleRecords.map((record) => (
          <article
            key={record.id}
            className="group rounded-[0.95rem] bg-[#f0eefb] px-6 py-5 transition hover:bg-[#e9e5fb]"
          >
            <div className="flex items-center gap-4">
              <span
                aria-hidden="true"
                className="h-10 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: record.accentColor, color: record.accentColor }}
              />
              <div className="min-w-0 flex-1">
                <div className="min-w-0">
                  <span className="block text-[0.86rem] font-black text-[#74708b]">
                    {record.subject}
                  </span>
                </div>
                <p className="mt-1.5 truncate text-[1.08rem] font-black leading-none text-[#24213d]">{record.nodeName}</p>
              </div>
              <time className="shrink-0 text-[0.96rem] font-semibold text-[#62607c]">{formatDate(record.updatedAt)}</time>
              <span className="shrink-0 text-[1.3rem] text-[#aaa6c0] transition group-hover:translate-x-0.5 group-hover:text-[#817cf2]">
                →
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
