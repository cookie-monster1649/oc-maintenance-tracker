import { useRef } from "react";
import { Vendor } from "@/lib/vendors";
import {
  INPUT_BASE,
  SELECT_BASE,
  TEXTAREA_BASE,
  BUTTON_PRIMARY,
  BUTTON_SECONDARY,
  MODAL_BACKDROP,
  MODAL_CONTENT,
  MODAL_TITLE,
  MODAL_DIVIDER,
} from "@/lib/ui-constants";

interface EditFormData {
  title?: string;
  description?: string;
  start_date?: string;
  frequency?: string;
  estimated_cost?: number | string;
  category?: string;
  vendor_id?: string;
}

interface EditTaskModalProps {
  isOpen: boolean;
  editForm: EditFormData;
  setEditForm: (form: EditFormData) => void;
  categories: string[];
  vendors: Vendor[];
  onSave: () => void;
  onClose: () => void;
}

export default function EditTaskModal({
  isOpen,
  editForm,
  setEditForm,
  categories,
  vendors,
  onSave,
  onClose,
}: EditTaskModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  // ── Render ──
  return (
    <div
      ref={backdropRef}
      className={MODAL_BACKDROP}
      onClick={(e) => {
        if (e.target === backdropRef.current) onClose();
      }}
    >
      <div className={MODAL_CONTENT}>
        <h2 className={MODAL_TITLE}>
          Edit Task
        </h2>
        <div className="space-y-5 flex-1">
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Title
            </label>
            <input
              value={editForm.title ?? ""}
              onChange={(e) =>
                setEditForm({ ...editForm, title: e.target.value })
              }
              className={INPUT_BASE}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Description
            </label>
            <textarea
              value={editForm.description ?? ""}
              onChange={(e) =>
                setEditForm({ ...editForm, description: e.target.value })
              }
              rows={2}
              className={TEXTAREA_BASE}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Due date
              </label>
              <input
                type="date"
                value={editForm.start_date ?? ""}
                onChange={(e) =>
                  setEditForm({ ...editForm, start_date: e.target.value })
                }
                className={INPUT_BASE}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Est. cost
              </label>
              <input
                type="number"
                value={editForm.estimated_cost ?? ""}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    estimated_cost: e.target.value,
                  })
                }
                className={INPUT_BASE}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Category
              </label>
              <select
                value={editForm.category ?? ""}
                onChange={(e) =>
                  setEditForm({ ...editForm, category: e.target.value })
                }
                className={SELECT_BASE}
              >
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Vendor
              </label>
              <select
                value={editForm.vendor_id ?? ""}
                onChange={(e) =>
                  setEditForm({ ...editForm, vendor_id: e.target.value })
                }
                className={INPUT_BASE}
              >
                <option value="">None</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className={MODAL_DIVIDER}>
          <button onClick={onSave} className={`flex-1 ${BUTTON_PRIMARY}`}>
            Save
          </button>
          <button onClick={onClose} className={`flex-1 ${BUTTON_SECONDARY}`}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
