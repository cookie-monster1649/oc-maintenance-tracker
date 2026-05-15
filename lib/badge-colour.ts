export const PALETTE = [
  "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400",
  "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400",
  "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-400",
  "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400",
  "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-400",
];

export function badgeColour(label: string | null): string {
  const text = label || "Document";
  const sum = [...text].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return PALETTE[sum % PALETTE.length];
}
