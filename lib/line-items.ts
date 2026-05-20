import fs from "fs";
import path from "path";
import type { DocumentRef } from "./tasks";

const DATA_PATH = path.join(process.cwd(), "data/line_items.json");

export interface OCYEntry {
  year: number;
  budget: number | null;
}

export interface LineItem {
  id: string;
  title: string;
  description: string;
  category: string;
  vendor_id: string | null;
  ocy_entries: OCYEntry[];
  archived: boolean;
  documents?: DocumentRef[];
}

function migrateLineItem(item: Record<string, unknown>): LineItem {
  // Migrate old ocy/ocy_budget or fy/fy_budget to ocy_entries array
  let ocY: number;
  let budget: number | null;

  if (item.ocy_entries !== undefined && Array.isArray(item.ocy_entries)) {
    // Already migrated
    return {
      id: item.id as string,
      title: item.title as string,
      description: item.description as string,
      category: item.category as string,
      vendor_id: item.vendor_id as string | null,
      ocy_entries: item.ocy_entries as OCYEntry[],
      archived: (item.archived as boolean) ?? false,
      documents: item.documents as DocumentRef[] | undefined,
    };
  }

  // Convert old single-year format to multi-year format
  if (item.ocy !== undefined) {
    ocY = item.ocy as number;
  } else if (item.fy !== undefined) {
    // Convert old FY year to OC year by subtracting 1
    ocY = ((item.fy as number) - 1);
  } else {
    ocY = 2026;
  }

  budget = item.ocy_budget !== undefined ? (item.ocy_budget as number | null) : (item.fy_budget as number | null);

  return {
    id: item.id as string,
    title: item.title as string,
    description: item.description as string,
    category: item.category as string,
    vendor_id: item.vendor_id as string | null,
    ocy_entries: [{ year: ocY, budget }],
    archived: (item.archived as boolean) ?? false,
    documents: item.documents as DocumentRef[] | undefined,
  };
}

export function readLineItems(): LineItem[] {
  if (!fs.existsSync(DATA_PATH)) {
    return [];
  }
  const raw = fs.readFileSync(DATA_PATH, "utf-8");
  const items = JSON.parse(raw);
  return items.map(migrateLineItem);
}

export function writeLineItems(items: LineItem[]): void {
  const dir = path.dirname(DATA_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(DATA_PATH, JSON.stringify(items, null, 2));
}
