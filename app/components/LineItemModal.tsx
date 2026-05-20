"use client";

import { useRef, useEffect, useMemo, useState, useCallback } from "react";
import type { LineItem } from "@/lib/line-items";
import type { Vendor } from "@/lib/vendors";

const INPUT =
  "w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-600";

interface OCYEntryForm {
  year: number;
  budget: string;
  isTaskDriven?: boolean;
}

interface FormState {
  title: string;
  description: string;
  category: string;
  vendor_id: string;
  ocy_entries: OCYEntryForm[];
}

function getCurrentOCYear(): number {
  const d = new Date();
  return d.getMonth() >= 3 ? d.getFullYear() + 1 : d.getFullYear();
}

function emptyForm(): FormState {
  return {
    title: "",
    description: "",
    category: "",
    vendor_id: "",
    ocy_entries: [{ year: getCurrentOCYear(), budget: "" }],
  };
}

function fromLineItem(lineItem: LineItem, taskYears?: number[]): FormState {
  const taskYearSet = new Set(taskYears ?? []);
  const existingYears = new Set(lineItem.ocy_entries.map((e) => e.year));
  const taskOnlyYears = [...taskYearSet].filter((y) => !existingYears.has(y));

  return {
    title: lineItem.title,
    description: lineItem.description,
    category: lineItem.category,
    vendor_id: lineItem.vendor_id ?? "",
    ocy_entries: [
      ...lineItem.ocy_entries.map((e) => ({
        year: e.year,
        budget: e.budget != null ? String(e.budget) : "",
        isTaskDriven: taskYearSet.has(e.year),
      })),
      ...taskOnlyYears.map((year) => ({ year, budget: "", isTaskDriven: true })),
    ].sort((a, b) => a.year - b.year),
  };
}

export default function LineItemModal({
  isOpen,
  lineItem,
  categories,
  vendors,
  taskYears,
  onSave,
  onClose,
}: {
  isOpen: boolean;
  lineItem?: LineItem | null;
  categories: string[];
  vendors: Vendor[];
  taskYears?: number[];
  onSave: () => void;
  onClose: () => void;
}) {
  const isEdit = lineItem != null;
  const backdropRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState<FormState | null>(null);
  const [originalForm, setOriginalForm] = useState<FormState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const updateForm = (updates: Partial<FormState>) =>
    setForm((f) => (f ? { ...f, ...updates } : null));

  const initialize = useCallback(() => {
    const initial = isEdit ? fromLineItem(lineItem, taskYears) : emptyForm();
    setForm(initial);
    setOriginalForm(initial);
    setError(null);
  }, [isEdit, lineItem, taskYears]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isOpen) initialize();
  }, [isOpen, initialize]);

  const currentOCYear = useMemo(() => getCurrentOCYear(), []);

  const ocYearOptions = useMemo(() => {
    const opts = new Set<number>();
    for (let i = currentOCYear - 2; i <= currentOCYear + 2; i++) opts.add(i);
    lineItem?.ocy_entries.forEach((e) => opts.add(e.year));
    return [...opts].sort((a, b) => a - b);
  }, [currentOCYear, lineItem?.ocy_entries]);

  if (!isOpen || !form) return null;

  const hasChanges = JSON.stringify(form) !== JSON.stringify(originalForm);

  const handleClose = () => {
    if (isEdit && hasChanges && !confirm("Discard unsaved changes?")) return;
    onClose();
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const payload = {
        title: form.title,
        description: form.description,
        category: form.category,
        vendor_id: form.vendor_id || null,
        ocy_entries: form.ocy_entries
          .filter((e) => !e.isTaskDriven || e.budget !== "")
          .map((e) => ({ year: e.year, budget: e.budget ? Number(e.budget) : null })),
        ...(isEdit ? {} : { archived: false }),
      };

      const res = await fetch(
        isEdit ? `/api/line-items/${lineItem.id}` : "/api/line-items",
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      if (!res.ok) throw new Error(await res.text());

      onSave();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      ref={backdropRef}
      className="animate-backdrop fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === backdropRef.current) handleClose();
      }}
    >
      <div className="animate-modal bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto flex flex-col p-8">
        <h2 className="text-2xl font-bold mb-8 text-gray-900 dark:text-gray-100 shrink-0">
          {isEdit ? "Edit Line Item" : "Create Line Item"}
        </h2>

        <div className="space-y-5 flex-1 overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Title *
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => updateForm({ title: e.target.value })}
              placeholder={isEdit ? undefined : "e.g., Fire System Maintenance"}
              className={INPUT}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) => updateForm({ description: e.target.value })}
              placeholder={isEdit ? undefined : "Optional details about this line item"}
              rows={3}
              className={INPUT}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Category *
            </label>
            <select
              value={form.category}
              onChange={(e) => updateForm({ category: e.target.value })}
              className={INPUT}
            >
              <option value="">Select a category</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
              OC Years
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Budget for OC Years. Leave empty for task based calculation.
            </p>
            <div className="space-y-3">
              {form.ocy_entries.map((entry, idx) => (
                <div key={idx} className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="text-xs text-gray-600 dark:text-gray-400">Year</label>
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mt-1 flex items-center gap-1.5">
                      OC-Y{entry.year}
                      {entry.isTaskDriven && (
                        <span className="text-xs text-gray-400 dark:text-gray-500 font-normal">tasks</span>
                      )}
                    </div>
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-gray-600 dark:text-gray-400">Budget (optional)</label>
                    <input
                      type="number"
                      value={entry.budget}
                      onChange={(e) => {
                        const newEntries = [...form.ocy_entries];
                        newEntries[idx] = { ...newEntries[idx], budget: e.target.value };
                        updateForm({ ocy_entries: newEntries });
                      }}
                      placeholder="—"
                      className={INPUT}
                    />
                  </div>
                  {entry.isTaskDriven ? (
                    <div className="px-2 py-2 w-16" />
                  ) : (
                    <button
                      onClick={() =>
                        updateForm({ ocy_entries: form.ocy_entries.filter((_, i) => i !== idx) })
                      }
                      className="text-red-600 hover:text-red-700 text-sm font-medium px-2 py-2"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
            <select
              onChange={(e) => {
                if (e.target.value) {
                  const year = Number(e.target.value);
                  updateForm({ ocy_entries: [...form.ocy_entries, { year, budget: "" }] });
                  e.target.value = "";
                }
              }}
              className="mt-3 text-sm px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800"
            >
              <option value="">+ Add year...</option>
              {ocYearOptions
                .filter((y) => !form.ocy_entries.some((e) => e.year === y))
                .map((year) => (
                  <option key={year} value={year}>
                    OC-Y{year}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Default vendor
            </label>
            <select
              value={form.vendor_id}
              onChange={(e) => updateForm({ vendor_id: e.target.value })}
              className={INPUT}
            >
              <option value="">No vendor assigned</option>
              {vendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-3 mt-8 pt-6 border-t border-gray-100 dark:border-gray-800 shrink-0">
          <button
            onClick={handleClose}
            className="flex-1 text-sm px-4 py-2 rounded-md border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!form.title || !form.category || isLoading}
            className="flex-1 text-sm px-4 py-2 rounded-md bg-gray-900 dark:bg-gray-700 text-white hover:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {isLoading ? (isEdit ? "Saving..." : "Creating...") : isEdit ? "Save" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
