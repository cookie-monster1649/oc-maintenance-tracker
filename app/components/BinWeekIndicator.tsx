"use client";

import { useState } from "react";
import { useGodMode } from "@/app/contexts/god-mode";
import BinWeekModal from "@/app/components/BinWeekModal";
import type { BinColor } from "@/lib/bin-weeks";

interface BinWeekIndicatorProps {
  bins: BinColor[];
}

const BIN_EMOJI: Record<BinColor, string> = {
  green: "🟢",
  yellow: "🟡",
  black: "⚫",
};

export default function BinWeekIndicator({ bins }: BinWeekIndicatorProps) {
  const { godMode } = useGodMode();
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Bin week:</span>
        {godMode && (
          <button
            onClick={() => setModalOpen(true)}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
            title="Edit bin weeks"
          >
            <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        )}
        <div className="flex gap-1 text-lg">
          {bins.map((bin) => (
            <span key={bin}>{BIN_EMOJI[bin]}</span>
          ))}
        </div>
      </div>

      {modalOpen && <BinWeekModal onClose={() => setModalOpen(false)} />}
    </>
  );
}
