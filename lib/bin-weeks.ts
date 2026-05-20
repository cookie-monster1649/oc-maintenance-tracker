import fs from "fs";
import path from "path";

export type BinColor = "green" | "yellow" | "black" | "purple" | "red";

export interface BinWeeksConfig {
  coming_up: BinColor[];
  following_week: BinColor[];
  rotation_day_of_week: number; // 0-6, where 0=Sunday, 2=Tuesday, etc.
}

const DATA_PATH = path.join(process.cwd(), "data/bin_weeks.json");

const DEFAULT_CONFIG: BinWeeksConfig = {
  coming_up: ["green", "yellow"],
  following_week: ["black"],
  rotation_day_of_week: 2, // Tuesday
};

function getCurrentWeek(): "coming_up" | "following_week" {
  const config = readBinWeeks();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dayOfWeek = today.getDay();
  const rotationDay = config.rotation_day_of_week;

  // Calculate the start of the current "week" (from rotation_day)
  const daysFromRotationDay = dayOfWeek >= rotationDay ? dayOfWeek - rotationDay : dayOfWeek + 7 - rotationDay;
  const weekStartDate = new Date(today);
  weekStartDate.setDate(weekStartDate.getDate() - daysFromRotationDay);

  // Count how many complete rotation cycles (weeks) have passed since Jan 1 of this year
  const yearStart = new Date(today.getFullYear(), 0, 1);
  yearStart.setHours(0, 0, 0, 0);
  const weeksPassed = Math.floor((weekStartDate.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24 * 7));

  return weeksPassed % 2 === 0 ? "coming_up" : "following_week";
}

export function readBinWeeks(): BinWeeksConfig {
  if (!fs.existsSync(DATA_PATH)) {
    return DEFAULT_CONFIG;
  }
  const raw = fs.readFileSync(DATA_PATH, "utf-8");
  return JSON.parse(raw);
}

export function writeBinWeeks(config: BinWeeksConfig): void {
  fs.writeFileSync(DATA_PATH, JSON.stringify(config, null, 2));
}

export function getCurrentBins(): BinColor[] {
  const config = readBinWeeks();
  const week = getCurrentWeek();
  return config[week];
}

export function updateBinWeeks(updates: Partial<BinWeeksConfig>): BinWeeksConfig {
  const config = readBinWeeks();
  const updated = { ...config, ...updates };
  writeBinWeeks(updated);
  return updated;
}
