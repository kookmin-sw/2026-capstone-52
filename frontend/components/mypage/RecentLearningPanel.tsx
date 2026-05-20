"use client";

import { useRouter } from "next/navigation";
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
  loading?: boolean;
  error?: string | null;
}

export default function RecentLearningPanel({ records, loading = false, error = null }: RecentLearningPanelProps) {
  const router = useRouter();
  const visibleRecords = records.slice(0, 5);

  function handleRecordClick(record: RecentLearningRecord) {
    const params = new URLSearchParams({
      projectId: record.projectId,
    });

    if (record.chatId) {
      params.set("chatId", record.chatId);
    }

    router.push(`/dashboard?${params.toString()}`);
  }

  return (
    <section className="flex h-[clamp(560px,61vh,672px)] min-h-0 flex-col rounded-[1.45rem] border border-[#ebe9f5] bg-white px-[clamp(32px,3vw,48px)] py-[clamp(28px,3vh,40px)] shadow-[0_24px_70px_rgba(42,38,73,0.06)]">
      <div className="mb-7 flex items-center justify-between gap-3">
        <h3 className="text-[1.35rem] font-black text-[#24213d]">최근 학습 기록</h3>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-0">
        {loading
          ? Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="rounded-[0.95rem] bg-[#f0eefb] px-6 py-5" aria-hidden="true">
                <div className="flex items-center gap-4">
                  <span className="h-10 w-1.5 shrink-0 rounded-full bg-white/70" />
                  <div className="min-w-0 flex-1">
                    <span className="block h-3 w-24 rounded-full bg-white/70" />
                    <span className="mt-3 block h-5 w-64 max-w-full rounded-full bg-white/70" />
                  </div>
                  <span className="h-4 w-20 shrink-0 rounded-full bg-white/70" />
                </div>
              </div>
            ))
          : null}

        {!loading && error ? (
          <div className="flex h-full min-h-[220px] items-center justify-center rounded-[0.95rem] bg-[#f0eefb] px-6 text-center text-[0.95rem] font-bold text-[#74708b]">
            {error}
          </div>
        ) : null}

        {!loading && !error && visibleRecords.length === 0 ? (
          <div className="h-full min-h-[220px] rounded-[0.95rem] bg-[#f8f7fd]" aria-hidden="true" />
        ) : null}

        {!loading && !error ? visibleRecords.map((record) => (
          <button
            key={record.id}
            type="button"
            className="group block w-full rounded-[0.95rem] bg-[#f0eefb] px-6 py-5 text-left transition hover:bg-[#e9e5fb] focus:outline-none focus:ring-2 focus:ring-[#817cf2]/40"
            onClick={() => handleRecordClick(record)}
            aria-label={`${record.nodeName} ${record.chatId ? "채팅방" : "프로젝트"}으로 이동`}
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
          </button>
        )) : null}
      </div>
    </section>
  );
}
