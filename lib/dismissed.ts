import fs from "fs";
import path from "path";

const DATA_PATH = path.join(process.cwd(), "data/dismissed_documents.json");

export interface DismissedDocument {
  id: number;
  dismissed_at: string;
}

export function readDismissed(): DismissedDocument[] {
  if (!fs.existsSync(DATA_PATH)) {
    return [];
  }
  const raw = fs.readFileSync(DATA_PATH, "utf-8");
  return JSON.parse(raw);
}

export function writeDismissed(dismissed: DismissedDocument[]): void {
  const dir = path.dirname(DATA_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(DATA_PATH, JSON.stringify(dismissed, null, 2));
}

export function addDismissed(id: number): void {
  const dismissed = readDismissed();
  if (!dismissed.some((d) => d.id === id)) {
    dismissed.push({ id, dismissed_at: new Date().toISOString() });
    writeDismissed(dismissed);
  }
}

export function removeDismissed(id: number): void {
  const dismissed = readDismissed();
  const filtered = dismissed.filter((d) => d.id !== id);
  writeDismissed(filtered);
}
