import fs from "fs";
import path from "path";

const DATA_PATH = path.join(process.cwd(), "data/categories.json");

export function readCategories(): string[] {
  if (!fs.existsSync(DATA_PATH)) {
    return [];
  }
  const raw = fs.readFileSync(DATA_PATH, "utf-8");
  return JSON.parse(raw);
}

export function writeCategories(categories: string[]): void {
  fs.writeFileSync(DATA_PATH, JSON.stringify(categories, null, 2));
}
