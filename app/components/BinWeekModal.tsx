"use client";

import { useState, useEffect } from "react";
import type { BinColor, BinWeeksConfig } from "@/lib/bin-weeks";

interface BinWeekModalProps {
  onClose: () => void;
}

const BIN_EMOJI: Record<BinColor, string> = {
  green: "🟢",
  yellow: "🟡",
  black: "⚫",
};

const BIN_COLORS: BinColor[] = ["green", "yellow", "black"];

export default function BinWeekModal({ onClose }: BinWeekModalProps) {
  const [config, setConfig] = useState<BinWeeksConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/bin-weeks")
      .then((res) => res.json())
      .then((data) => {
        setConfig(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const toggleBin = (week: "coming_up" | "following_week", bin: BinColor) => {
    if (!config) return;

    const current = config[week];
    const updated = current.includes(bin) ? current.filter((b) => b !== bin) : [...current, bin];

    setConfig({
      ...config,
      [week]: updated,
    });
  };

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);

    try {
      const res = await fetch("/api/bin-weeks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coming_up: config.coming_up,
          following_week: config.following_week,
        }),
      });

      if (res.ok) {
        onClose();
      }
    } catch {
      // Error silently, let user retry
    } finally {
      setSaving(false);
    }
  };

  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  if (loading || !config) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Configure Bin Weeks</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Rotation day selector */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
              Rotation day
            </label>
            <select
              value={config.rotation_day_of_week}
              onChange={(e) => setConfig({ ...config, rotation_day_of_week: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              {dayNames.map((day, i) => (
                <option key={i} value={i}>
                  {day}
                </option>
              ))}
            </select>
          </div>

          {/* Coming up */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Coming up</h3>
            <div className="space-y-2">
              {BIN_COLORS.map((bin) => (
                <label key={bin} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.coming_up.includes(bin)}
                    onChange={() => toggleBin("coming_up", bin)}
                    className="w-4 h-4 rounded border-gray-300 dark:border-gray-600"
                  />
                  <span className="text-lg">{BIN_EMOJI[bin]}</span>
                  <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">{bin}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Following week */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Following week</h3>
            <div className="space-y-2">
              {BIN_COLORS.map((bin) => (
                <label key={bin} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.following_week.includes(bin)}
                    onChange={() => toggleBin("following_week", bin)}
                    className="w-4 h-4 rounded border-gray-300 dark:border-gray-600"
                  />
                  <span className="text-lg">{BIN_EMOJI[bin]}</span>
                  <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">{bin}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-800">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
