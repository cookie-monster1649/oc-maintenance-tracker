"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useGodMode } from "./contexts/god-mode";
import {
  NAV_LINK,
  SETTINGS_BUTTON,
  BUTTON_SECONDARY,
  BUTTON_PRIMARY,
  INPUT_BASE,
  SELECT_BASE,
} from "@/lib/ui-constants";

type Theme = "light" | "dark" | "system";
type ColorName =
  | "blue"
  | "purple"
  | "green"
  | "red"
  | "amber"
  | "pink"
  | "cyan"
  | "indigo";

interface CategoryItem {
  name: string;
  color: ColorName;
}

const THEMES: { value: Theme; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

function applyTheme(newTheme: Theme) {
  const html = document.documentElement;
  if (newTheme === "system") {
    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    html.classList.toggle("dark", isDark);
  } else {
    html.classList.toggle("dark", newTheme === "dark");
  }
}

const colorOptions: ColorName[] = [
  "blue",
  "purple",
  "green",
  "red",
  "amber",
  "pink",
  "cyan",
  "indigo",
];
const colorLabels: Record<ColorName, string> = {
  blue: "Blue",
  purple: "Purple",
  green: "Green",
  red: "Red",
  amber: "Amber",
  pink: "Pink",
  cyan: "Cyan",
  indigo: "Indigo",
};

export default function Header() {
  const { godMode, enable: enableGodMode, disable: disableGodMode } = useGodMode();
  // Initialize theme from localStorage immediately to prevent hydration mismatch
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return "system";
    return (localStorage.getItem("theme") as Theme) ?? "system";
  });
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryColor, setNewCategoryColor] = useState<ColorName>("blue");
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [tasks, setTasks] = useState<
    { id: string; title: string; category: string }[]
  >([]);
  const [reassigningCategory, setReassigningCategory] = useState<string | null>(
    null,
  );
  const [reassignTarget, setReassignTarget] = useState("");
  const [importing, setImporting] = useState(false);
  const [godModeOpen, setGodModeOpen] = useState(false);
  const [godModePassword, setGodModePassword] = useState("");
  const [godModeError, setGodModeError] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  async function handleExport() {
    const res = await fetch("/api/data");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `oc-maintenance-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setOpen(false);
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    let data: unknown;
    try {
      data = JSON.parse(await file.text());
    } catch {
      alert("Could not parse file. Make sure it's a valid JSON export.");
      return;
    }

    if (!confirm("This will replace all current data. Are you sure?")) return;

    setImporting(true);
    try {
      const res = await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const { error } = await res.json();
        alert(`Import failed: ${error}`);
        return;
      }
      window.location.reload();
    } catch {
      alert("Import failed. Check the console for details.");
    } finally {
      setImporting(false);
    }
  }

  async function loadCategories() {
    try {
      setLoadingCategories(true);
      const [categoriesRes, tasksRes] = await Promise.all([
        fetch("/api/categories"),
        fetch("/api/tasks"),
      ]);
      const categoriesData = await categoriesRes.json();
      const tasksData = await tasksRes.json();
      setCategories(categoriesData);
      setTasks(tasksData);
    } catch (error) {
      console.error("Failed to load categories:", error);
    } finally {
      setLoadingCategories(false);
    }
  }

  async function addCategory() {
    if (!newCategoryName.trim()) return;
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCategoryName,
          color: newCategoryColor,
        }),
      });
      if (res.ok) {
        await loadCategories();
        setNewCategoryName("");
        setNewCategoryColor("blue");
      }
    } catch (error) {
      console.error("Failed to add category:", error);
    }
  }

  async function updateCategoryColor(name: string, color: ColorName) {
    try {
      const res = await fetch(`/api/categories/${encodeURIComponent(name)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ color }),
      });
      if (res.ok) {
        await loadCategories();
      }
    } catch (error) {
      console.error("Failed to update category:", error);
    }
  }

  async function deleteCategory(name: string) {
    const tasksWithCategory = tasks.filter((t) => t.category === name);

    if (tasksWithCategory.length > 0) {
      setReassigningCategory(name);
      setReassignTarget("");
      return;
    }

    if (!confirm(`Delete category "${name}"?`)) return;
    try {
      const res = await fetch(`/api/categories/${encodeURIComponent(name)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await loadCategories();
      }
    } catch (error) {
      console.error("Failed to delete category:", error);
    }
  }

  async function confirmReassignment() {
    if (!reassigningCategory || !reassignTarget) return;

    try {
      const tasksWithCategory = tasks.filter(
        (t) => t.category === reassigningCategory,
      );
      await Promise.all(
        tasksWithCategory.map((task) =>
          fetch(`/api/tasks/${task.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...task, category: reassignTarget }),
          }),
        ),
      );

      const res = await fetch(
        `/api/categories/${encodeURIComponent(reassigningCategory)}`,
        {
          method: "DELETE",
        },
      );
      if (res.ok) {
        await loadCategories();
        setReassigningCategory(null);
        setReassignTarget("");
      }
    } catch (error) {
      console.error("Failed to reassign and delete category:", error);
    }
  }

  useEffect(() => {
    // Mark as mounted and load categories (theme is already initialized from localStorage)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    loadCategories();
  }, []);

  // Apply theme whenever it changes
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Close on outside click
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  function handleThemeChange(newTheme: Theme) {
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    applyTheme(newTheme);
  }

  function handleGodModeEnable() {
    setGodModeError("");
    if (enableGodMode(godModePassword)) {
      setGodModePassword("");
      setGodModeOpen(false);
      setOpen(false);
    } else {
      setGodModeError("Incorrect password");
    }
  }

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
      <div className="content-container flex items-center justify-between h-14">
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden flex items-center justify-center w-8 h-8 rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="Menu"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="18" x2="20" y2="18" />
          </svg>
        </button>

        <nav className="hidden md:flex gap-8">
          <Link href="/" className={NAV_LINK}>
            Home
          </Link>
          <Link href="/tasks" className={NAV_LINK}>
            Tasks
          </Link>
          <Link
            href="/vendors"
            className="text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-gray-500 dark:hover:text-gray-400 transition-colors"
          >
            Vendors
          </Link>
          <Link
            href="/documents"
            className="text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-gray-500 dark:hover:text-gray-400 transition-colors"
          >
            Documents
          </Link>
          <Link
            href="/costs"
            className="text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-gray-500 dark:hover:text-gray-400 transition-colors"
          >
            Costs
          </Link>
        </nav>

        <div ref={ref} className="relative">
          <button
            onClick={() => setOpen((o) => !o)}
            className={SETTINGS_BUTTON}
            aria-label="Settings"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>

          {open && mounted && (
            <div className="animate-dropdown absolute right-0 mt-2 w-56 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-xl z-50">
              <div className="px-4 pt-4 pb-3 border-b border-gray-100 dark:border-gray-800">
                <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">
                  Theme
                </p>
                <div className="flex rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden">
                  {THEMES.map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => handleThemeChange(value)}
                      className={`flex-1 text-xs py-1.5 font-medium transition-colors ${
                        theme === value
                          ? "bg-gray-900 dark:bg-gray-600 text-white"
                          : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {godMode && (
                <button
                  onClick={() => {
                    setCategoriesOpen(true);
                    setOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors border-b border-gray-100 dark:border-gray-800"
                >
                  Categories
                </button>
              )}
              {godMode && (
                <div className="flex gap-0 border-b border-gray-100 dark:border-gray-800">
                  <button
                    onClick={handleExport}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors border-r border-gray-100 dark:border-gray-800"
                  >
                    Export data
                  </button>
                  <button
                    onClick={() => {
                      setOpen(false);
                      importInputRef.current?.click();
                    }}
                    disabled={importing}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
                  >
                    {importing ? "Importing…" : "Import data"}
                  </button>
                </div>
              )}
              <button
                onClick={() => {
                  if (godMode) {
                    disableGodMode();
                    setOpen(false);
                  } else {
                    setGodModeOpen(true);
                  }
                }}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors border-b border-gray-100 dark:border-gray-800"
              >
                {godMode ? (
                  <>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    <span>Disable God mode</span>
                  </>
                ) : (
                  <>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 9.2-1" />
                    </svg>
                    <span>Enable God mode</span>
                  </>
                )}
              </button>
              <Link
                href="/archived"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors rounded-b-lg"
              >
                Archived
              </Link>
            </div>
          )}
        </div>
      </div>

      {mobileMenuOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 top-14 bg-black/20 z-40"
            onClick={() => setMobileMenuOpen(false)}
          />
          <nav className="md:hidden fixed top-14 left-0 right-0 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 z-50 animate-dropdown">
            <div className="flex flex-col gap-0 px-4 py-2">
              <Link
                href="/"
                onClick={() => setMobileMenuOpen(false)}
                className="py-2.5 text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-gray-500 dark:hover:text-gray-400 transition-colors"
              >
                Home
              </Link>
              <Link
                href="/tasks"
                onClick={() => setMobileMenuOpen(false)}
                className="py-2.5 text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-gray-500 dark:hover:text-gray-400 transition-colors"
              >
                Tasks
              </Link>
              <Link
                href="/vendors"
                onClick={() => setMobileMenuOpen(false)}
                className="py-2.5 text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-gray-500 dark:hover:text-gray-400 transition-colors"
              >
                Vendors
              </Link>
              <Link
                href="/documents"
                onClick={() => setMobileMenuOpen(false)}
                className="py-2.5 text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-gray-500 dark:hover:text-gray-400 transition-colors"
              >
                Documents
              </Link>
              <Link
                href="/costs"
                onClick={() => setMobileMenuOpen(false)}
                className="py-2.5 text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-gray-500 dark:hover:text-gray-400 transition-colors"
              >
                Costs
              </Link>
            </div>
          </nav>
        </>
      )}

      {reassigningCategory && mounted && (
        <div className="animate-backdrop fixed inset-0 bg-black/50 flex items-center justify-center z-60 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto flex flex-col p-8">
            <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100 shrink-0">
              Reassign Tasks
            </h2>

            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              {tasks.filter((t) => t.category === reassigningCategory).length}{" "}
              task(s) to reassign:
            </p>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-6 max-h-48 overflow-y-auto">
              <ul className="space-y-2">
                {tasks
                  .filter((t) => t.category === reassigningCategory)
                  .map((task) => (
                    <li
                      key={task.id}
                      className="text-sm text-gray-700 dark:text-gray-300"
                    >
                      • {task.title}
                    </li>
                  ))}
              </ul>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Reassign to category:
              </label>
              <select
                value={reassignTarget}
                onChange={(e) => setReassignTarget(e.target.value)}
                className={INPUT_BASE}
              >
                <option value="">Select a category</option>
                {categories
                  .filter((c) => c.name !== reassigningCategory)
                  .map((cat) => (
                    <option key={cat.name} value={cat.name}>
                      {cat.name}
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex gap-3">
              <button
                onClick={confirmReassignment}
                disabled={!reassignTarget}
                className="flex-1 text-sm px-4 py-2 rounded-md bg-gray-900 dark:bg-gray-700 text-white hover:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-40 transition-colors font-medium"
              >
                Reassign & Delete
              </button>
              <button
                onClick={() => {
                  setReassigningCategory(null);
                  setReassignTarget("");
                }}
                className={`flex-1 ${BUTTON_SECONDARY}`}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {godModeOpen && mounted && (
        <div className="animate-backdrop fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-sm w-full flex flex-col p-8">
            <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">
              Enable God Mode
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Enter password to access administrative functions.
            </p>
            <input
              type="password"
              value={godModePassword}
              onChange={(e) => {
                setGodModePassword(e.target.value);
                setGodModeError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleGodModeEnable();
                }
              }}
              placeholder="Password"
              className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-400 mb-2"
            />
            {godModeError && (
              <p className="text-sm text-red-600 dark:text-red-400 mb-4">
                {godModeError}
              </p>
            )}
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleGodModeEnable}
                className={`flex-1 ${BUTTON_PRIMARY}`}
              >
                Enable
              </button>
              <button
                onClick={() => {
                  setGodModeOpen(false);
                  setGodModePassword("");
                  setGodModeError("");
                }}
                className={`flex-1 ${BUTTON_SECONDARY}`}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {categoriesOpen && mounted && (
        <div className="animate-backdrop fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto flex flex-col p-8">
            <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100 shrink-0">
              Categories
            </h2>

            {loadingCategories ? (
              <p className="text-gray-400">Loading...</p>
            ) : (
              <>
                <div className="space-y-3 flex-1 overflow-y-auto mb-6">
                  {categories.map((cat) => {
                    const colorMap: Record<
                      ColorName,
                      { bg: string; text: string }
                    > = {
                      blue: {
                        bg: "bg-blue-100 dark:bg-blue-900",
                        text: "text-blue-700 dark:text-blue-300",
                      },
                      purple: {
                        bg: "bg-purple-100 dark:bg-purple-900",
                        text: "text-purple-700 dark:text-purple-300",
                      },
                      green: {
                        bg: "bg-green-100 dark:bg-green-900",
                        text: "text-green-700 dark:text-green-300",
                      },
                      red: {
                        bg: "bg-red-100 dark:bg-red-900",
                        text: "text-red-700 dark:text-red-300",
                      },
                      amber: {
                        bg: "bg-amber-100 dark:bg-amber-900",
                        text: "text-amber-700 dark:text-amber-300",
                      },
                      pink: {
                        bg: "bg-pink-100 dark:bg-pink-900",
                        text: "text-pink-700 dark:text-pink-300",
                      },
                      cyan: {
                        bg: "bg-cyan-100 dark:bg-cyan-900",
                        text: "text-cyan-700 dark:text-cyan-300",
                      },
                      indigo: {
                        bg: "bg-indigo-100 dark:bg-indigo-900",
                        text: "text-indigo-700 dark:text-indigo-300",
                      },
                    };
                    const colors = colorMap[cat.color as ColorName];
                    return (
                      <div
                        key={cat.name}
                        className="flex items-center justify-between gap-3"
                      >
                        <div className="flex-1 min-w-0">
                          <span
                            className={`inline-block px-3 py-1.5 rounded-full text-sm font-medium ${colors.bg} ${colors.text}`}
                          >
                            {cat.name}
                          </span>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <select
                            value={cat.color}
                            onChange={(e) =>
                              updateCategoryColor(
                                cat.name,
                                e.target.value as ColorName,
                              )
                            }
                            className={`${SELECT_BASE} px-2 py-1`}
                          >
                            {colorOptions.map((color) => (
                              <option key={color} value={color}>
                                {colorLabels[color]}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => deleteCategory(cat.name)}
                            className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-sm font-medium"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    Add Category
                  </h3>
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder="Category name"
                      className={INPUT_BASE}
                    />
                    <select
                      value={newCategoryColor}
                      onChange={(e) =>
                        setNewCategoryColor(e.target.value as ColorName)
                      }
                      className={INPUT_BASE}
                    >
                      {colorOptions.map((color) => (
                        <option key={color} value={color}>
                          {colorLabels[color]}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={addCategory}
                      disabled={!newCategoryName.trim()}
                      className="w-full text-sm px-4 py-2 rounded-md bg-gray-900 dark:bg-gray-700 text-white hover:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-40 transition-colors font-medium"
                    >
                      Add Category
                    </button>
                  </div>
                </div>
              </>
            )}

            <div className="flex gap-3 mt-8 pt-6 border-t border-gray-100 dark:border-gray-800 shrink-0">
              <button
                onClick={() => setCategoriesOpen(false)}
                className={`flex-1 ${BUTTON_SECONDARY}`}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      <input
        ref={importInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={handleImportFile}
      />
    </header>
  );
}
