"use client";

import { useRef } from "react";

interface Vendor {
  id: string;
  name: string;
  service_type: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  archived?: boolean;
  paperless_correspondent_id?: number | null;
}

interface PaperlessCorrespondent {
  id: number;
  name: string;
}

interface VendorModalProps {
  isOpen: boolean;
  editing: Vendor | null;
  form: {
    name: string;
    service_type: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    notes: string | null;
    paperless_correspondent_id: number | null;
  };
  setForm: (form: VendorModalProps["form"]) => void;
  correspondents: PaperlessCorrespondent[];
  onClose: () => void;
  onSave: () => Promise<void>;
}

const INPUT =
  "w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-600";

export default function VendorModal({
  isOpen,
  editing,
  form,
  setForm,
  correspondents,
  onClose,
  onSave,
}: VendorModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

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
          {editing ? "Edit Vendor" : "New Vendor"}
        </h2>
        <div className="space-y-5 flex-1">
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Name
            </label>
            <input
              placeholder="e.g. ABC Plumbing"
              value={form.name}
              onChange={(e) =>
                setForm({ ...form, name: e.target.value })
              }
              className={INPUT}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Service type
            </label>
            <input
              placeholder="e.g. Plumbing, Electrical, Landscaping"
              value={form.service_type}
              onChange={(e) =>
                setForm({ ...form, service_type: e.target.value })
              }
              className={INPUT}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Phone
              </label>
              <input
                placeholder="0412 345 678"
                value={form.phone ?? ""}
                onChange={(e) =>
                  setForm({ ...form, phone: e.target.value })
                }
                className={INPUT}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Email
              </label>
              <input
                type="email"
                placeholder="contact@example.com.au"
                value={form.email ?? ""}
                onChange={(e) =>
                  setForm({ ...form, email: e.target.value })
                }
                className={INPUT}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Address
            </label>
            <input
              placeholder="123 Collins St, Melbourne VIC 3000"
              value={form.address ?? ""}
              onChange={(e) =>
                setForm({ ...form, address: e.target.value })
              }
              className={INPUT}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Notes
            </label>
            <textarea
              placeholder="Preferred contact times, parking notes, etc."
              value={form.notes ?? ""}
              onChange={(e) =>
                setForm({ ...form, notes: e.target.value })
              }
              rows={3}
              className={INPUT}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Paperless Correspondent
            </label>
            <select
              value={form.paperless_correspondent_id ?? ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  paperless_correspondent_id: e.target.value
                    ? parseInt(e.target.value, 10)
                    : null,
                })
              }
              className={INPUT}
            >
              <option value="">None (No document matching)</option>
              {correspondents.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {form.name &&
              !form.paperless_correspondent_id &&
              correspondents.some((c) =>
                c.name.toLowerCase().includes(form.name.toLowerCase()),
              ) && (
                <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                  Suggestion:{" "}
                  {
                    correspondents.find((c) =>
                      c.name
                        .toLowerCase()
                        .includes(form.name.toLowerCase()),
                    )?.name
                  }
                </p>
              )}
          </div>
        </div>
        <div className="flex gap-3 mt-8 pt-6 border-t border-gray-100 dark:border-gray-800 shrink-0">
          <button
            onClick={onSave}
            disabled={!form.name}
            className="flex-1 text-sm px-4 py-2 rounded-md bg-gray-900 dark:bg-gray-700 text-white hover:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-40 transition-colors font-medium"
          >
            Save
          </button>
          <button
            onClick={onClose}
            className="flex-1 text-sm px-4 py-2 rounded-md border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-medium"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
