"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import KnowledgeGalaxyScene from "@/components/mypage/KnowledgeGalaxyScene";
import type { GraphNodeRecord } from "@/types/profile";

interface GalaxyFullscreenModalProps {
  open: boolean;
  nodes: GraphNodeRecord[];
  onClose: () => void;
}

export default function GalaxyFullscreenModal({
  open,
  nodes,
  onClose,
}: GalaxyFullscreenModalProps) {
  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#05040b]/90 px-4 py-6 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="통합 그래프 전체 화면"
            className="relative flex h-full max-h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(9,8,15,0.98),rgba(11,13,21,0.98))] p-4 shadow-[0_40px_120px_rgba(0,0,0,0.5)]"
            initial={{ opacity: 0, scale: 0.96, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 12 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-4 px-2 pt-2">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-violet-200/55">Immersive View</p>
                <h3 className="mt-2 text-2xl font-semibold text-white">전체 지식 은하 그래프</h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-200 transition hover:border-violet-400/40 hover:bg-violet-500/10 hover:text-white"
                aria-label="그래프 닫기"
              >
                닫기
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-hidden rounded-[1.7rem] border border-white/10">
              <KnowledgeGalaxyScene nodes={nodes} />
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
