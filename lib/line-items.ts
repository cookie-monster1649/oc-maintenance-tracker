import fs from "fs";
import path from "path";
import type { DocumentRef } from "./tasks";

const DATA_PATH = path.join(process.cwd(), "data/line_items.json");

export interface LineItem {
  id: string;
  title: string;
  description: string;
  category: string;
  vendor_id: string | null;
  fy_budget: number | null;
  fy: number;
  archived: boolean;
  documents?: DocumentRef[];
}

export function readLineItems(): LineItem[] {
  if (!fs.existsSync(DATA_PATH)) {
    return [];
  }
  const raw = fs.readFileSync(DATA_PATH, "utf-8");
  return JSON.parse(raw);
}

export function writeLineItems(items: LineItem[]): void {
  const dir = path.dirname(DATA_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(DATA_PATH, JSON.stringify(items, null, 2));
}
