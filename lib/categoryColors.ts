import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const dataDir = join(process.cwd(), "data");
const categoriesFile = join(dataDir, "categories.json");
const colorsFile = join(dataDir, "categoryColors.json");

export type ColorName = "blue" | "purple" | "green" | "red" | "amber" | "pink" | "cyan" | "indigo";

const colorMap: Record<ColorName, { bg: string; text: string }> = {
  blue: { bg: "bg-blue-100 dark:bg-blue-900", text: "text-blue-700 dark:text-blue-300" },
  purple: { bg: "bg-purple-100 dark:bg-purple-900", text: "text-purple-700 dark:text-purple-300" },
  green: { bg: "bg-green-100 dark:bg-green-900", text: "text-green-700 dark:text-green-300" },
  red: { bg: "bg-red-100 dark:bg-red-900", text: "text-red-700 dark:text-red-300" },
  amber: { bg: "bg-amber-100 dark:bg-amber-900", text: "text-amber-700 dark:text-amber-300" },
  pink: { bg: "bg-pink-100 dark:bg-pink-900", text: "text-pink-700 dark:text-pink-300" },
  cyan: { bg: "bg-cyan-100 dark:bg-cyan-900", text: "text-cyan-700 dark:text-cyan-300" },
  indigo: { bg: "bg-indigo-100 dark:bg-indigo-900", text: "text-indigo-700 dark:text-indigo-300" },
};

export const colorOptions = Object.keys(colorMap) as ColorName[];

export function readCategories(): string[] {
  try {
    const data = readFileSync(categoriesFile, "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export function readCategoryColors(): Record<string, ColorName> {
  try {
    const data = readFileSync(colorsFile, "utf-8");
    return JSON.parse(data);
  } catch {
    return {};
  }
}

export function writeCategories(categories: string[]): void {
  writeFileSync(categoriesFile, JSON.stringify(categories, null, 2));
}

export function writeCategoryColors(colors: Record<string, ColorName>): void {
  writeFileSync(colorsFile, JSON.stringify(colors, null, 2));
}

export function addCategory(name: string, color: ColorName = "blue"): void {
  const categories = readCategories();
  if (!categories.includes(name)) {
    categories.push(name);
    writeCategories(categories);
  }
  const colors = readCategoryColors();
  colors[name] = color;
  writeCategoryColors(colors);
}

export function removeCategory(name: string): void {
  const categories = readCategories().filter((c) => c !== name);
  writeCategories(categories);
  const colors = readCategoryColors();
  delete colors[name];
  writeCategoryColors(colors);
}

export function updateCategoryColor(name: string, color: ColorName): void {
  const colors = readCategoryColors();
  colors[name] = color;
  writeCategoryColors(colors);
}

export function getCategoryColor(category: string): { bg: string; text: string } {
  const colors = readCategoryColors();
  const colorName = (colors[category] || "blue") as ColorName;
  return colorMap[colorName];
}

export function getCategoryColorName(category: string): ColorName {
  const colors = readCategoryColors();
  return (colors[category] || "blue") as ColorName;
}
