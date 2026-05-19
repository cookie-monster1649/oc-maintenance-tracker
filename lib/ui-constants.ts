// Reusable Tailwind className constants for consistent styling across components.
// Update here once to propagate to all pages.

// ── Input & Form Fields ──
export const INPUT_BASE =
  "w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-400";

export const INPUT_WITH_PLACEHOLDER = `${INPUT_BASE} placeholder-gray-400 dark:placeholder-gray-500`;

export const SELECT_BASE =
  "w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-400";

export const TEXTAREA_BASE =
  "w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-400";

// ── Buttons ──
export const BUTTON_PRIMARY =
  "text-sm px-4 py-2 rounded-md bg-gray-900 dark:bg-gray-700 text-white hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors font-medium";

export const BUTTON_PRIMARY_DISABLED =
  "text-sm px-4 py-2 rounded-md bg-gray-900 dark:bg-gray-700 text-white hover:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-40 transition-colors font-medium";

export const BUTTON_SECONDARY =
  "text-sm px-4 py-2 rounded-md border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-medium";

export const BUTTON_ICON =
  "text-sm px-3 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors";

export const BUTTON_DANGER =
  "text-sm px-3 py-1.5 rounded-md border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950";

// ── Navigation & Links ──
export const NAV_LINK =
  "text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-gray-500 dark:hover:text-gray-400 transition-colors";

export const SETTINGS_BUTTON =
  "flex items-center justify-center w-8 h-8 rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors";

// ── Modal & Backdrop ──
export const MODAL_BACKDROP =
  "animate-backdrop fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4";

// Modal content with size variants
export const MODAL_CONTENT_SM =
  "animate-modal bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto flex flex-col p-8";

export const MODAL_CONTENT =
  "animate-modal bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto flex flex-col p-8";

export const MODAL_CONTENT_LG =
  "animate-modal bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto flex flex-col p-6";

export const MODAL_TITLE =
  "text-2xl font-bold mb-8 text-gray-900 dark:text-gray-100 shrink-0";

export const MODAL_DIVIDER =
  "flex gap-3 mt-8 pt-6 border-t border-gray-100 dark:border-gray-800 shrink-0";

// ── Layout & Spacing ──
export const PAGE_HEADER =
  "flex items-start justify-between gap-8 mb-8";

export const PAGE_TITLE =
  "text-2xl font-semibold mb-1";

export const PAGE_SUBTITLE =
  "text-sm text-gray-500 dark:text-gray-400";
