"use client";

import { useRef } from "react";
import { useLineItemForm } from "@/app/hooks/useLineItemForm";
import { getColorClasses } from "@/lib/colors";
import type { Vendor } from "@/lib/vendors";

const INPUT =
  "w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-600";

export default function NewLineItemModal({
  isOpen,
  categories,
  categoryColors,
  vendors,
  onSave,
  onClose,
}: {
  isOpen: boolean;
  categories: string[];
  categoryColors: Record<string, string>;
  vendors: Vendor[];
  onSave: () => void;
  onClose: () => void;
}) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const { form, updateForm, submit, isLoading, error } = useLineItemForm(onSave);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    await submit();
    onClose();
  };

  return (
    <div
      ref={backdropRef}
      className="animate-backdrop fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === backdropRef.current) onClose();
      }}
    >
      <div className="animate-modal bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto flex flex-col p-8">
        <h2 className="text-2xl font-bold mb-8 text-gray-900 dark:text-gray-100 shrink-0">
          Create Line Item
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
              placeholder="e.g., Fire System Maintenance"
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
              placeholder="Optional details about this line item"
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

          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              FY Budget (Optional)
            </label>
            <input
              type="text"
              value={form.fy_budget}
              onChange={(e) => updateForm({ fy_budget: e.target.value })}
              placeholder="Fixed budget for this fiscal year (null = derived from tasks)"
              className={INPUT}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Leave blank to calculate budget from task occurrences
            </p>
          </div>
        </div>

        <div className="flex gap-3 mt-8 pt-6 border-t border-gray-100 dark:border-gray-800 shrink-0">
          <button
            onClick={onClose}
            className="flex-1 text-sm px-4 py-2 rounded-md border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!form.title || !form.category || isLoading}
            className="flex-1 text-sm px-4 py-2 rounded-md bg-gray-900 dark:bg-gray-700 text-white hover:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {isLoading ? "Creating..." : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
