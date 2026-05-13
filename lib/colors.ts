type ColorName = "blue" | "purple" | "green" | "red" | "amber" | "pink" | "cyan" | "indigo";

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

export function getColorClasses(colorName: string): { bg: string; text: string } {
  return colorMap[(colorName as ColorName) || "blue"] || colorMap.blue;
}
