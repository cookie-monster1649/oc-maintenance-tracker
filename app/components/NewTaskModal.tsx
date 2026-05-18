import { useRef } from "react";
import { Vendor } from "@/lib/vendors";
import {
  INPUT_BASE,
  INPUT_WITH_PLACEHOLDER,
  SELECT_BASE,
  BUTTON_PRIMARY_DISABLED,
  BUTTON_SECONDARY,
  MODAL_BACKDROP,
  MODAL_CONTENT,
  MODAL_TITLE,
  MODAL_DIVIDER,
} from "@/lib/ui-constants";

interface NewTaskData {
  title: string;
  description: string;
  task_type: "budget_item" | "once_off" | "recurring";
  frequency: string;
  variable_cost: boolean;
  start_date: string;
  budget_fy: number;
  estimated_cost: string;
  vendor_id: string;
  category: string;
}

interface NewTaskModalProps {
  isOpen: boolean;
  newTask: NewTaskData;
  setNewTask: (task: NewTaskData) => void;
  categories: string[];
  vendors: Vendor[];
  onSave: () => void;
  onClose: () => void;
}

export default function NewTaskModal({
  isOpen,
  newTask,
  setNewTask,
  categories,
  vendors,
  onSave,
  onClose,
}: NewTaskModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  // ── Render ──
  // Form fields render conditionally based on task_type (budget_item, once_off, recurring).
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
          New Task
        </h2>
        <div className="space-y-5 flex-1">
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Title
            </label>
            <input
              value={newTask.title}
              onChange={(e) =>
                setNewTask({ ...newTask, title: e.target.value })
              }
              className={INPUT_WITH_PLACEHOLDER}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Description
            </label>
            <textarea
              value={newTask.description}
              onChange={(e) =>
                setNewTask({ ...newTask, description: e.target.value })
              }
              rows={3}
              className={INPUT_WITH_PLACEHOLDER}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Type
            </label>
            <div className="flex gap-3">
              {(["budget_item", "once_off", "recurring"] as const).map((t) => (
                <label key={t} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="task_type"
                    value={t}
                    checked={newTask.task_type === t}
                    onChange={(e) =>
                      setNewTask({
                        ...newTask,
                        task_type: e.target.value as typeof t,
                      })
                    }
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {t === "budget_item"
                      ? "Budget item"
                      : t === "once_off"
                        ? "Once-off"
                        : "Recurring"}
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {newTask.task_type === "budget_item" ? (
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Fiscal year
                </label>
                <select
                  value={newTask.budget_fy}
                  onChange={(e) =>
                    setNewTask({
                      ...newTask,
                      budget_fy: Number(e.target.value),
                    })
                  }
                  className={INPUT_BASE}
                >
                  {[-1, 0, 1, 2].map((offset) => {
                    const now = new Date();
                    const currentFy =
                      now.getMonth() >= 6
                        ? now.getFullYear() + 1
                        : now.getFullYear();
                    const fy = currentFy + offset;
                    return (
                      <option key={fy} value={fy}>
                        FY{fy}
                      </option>
                    );
                  })}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Due date
                </label>
                <input
                  type="date"
                  value={newTask.start_date}
                  onChange={(e) =>
                    setNewTask({ ...newTask, start_date: e.target.value })
                  }
                  className={INPUT_BASE}
                />
              </div>
            )}
            {newTask.task_type === "recurring" && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Frequency
                </label>
                <select
                  value={newTask.frequency}
                  onChange={(e) =>
                    setNewTask({ ...newTask, frequency: e.target.value })
                  }
                  className={INPUT_BASE}
                >
                  {[
                    "Weekly",
                    "Bi-weekly",
                    "Monthly",
                    "Quarterly",
                    "Semi-Annually",
                    "Annually",
                  ].map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Category
              </label>
              <select
                value={newTask.category}
                onChange={(e) =>
                  setNewTask({ ...newTask, category: e.target.value })
                }
                className={INPUT_BASE}
              >
                <option value="">Select category</option>
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Est. cost ($)
              </label>
              <input
                type="number"
                value={newTask.estimated_cost}
                onChange={(e) =>
                  setNewTask({
                    ...newTask,
                    estimated_cost: e.target.value,
                  })
                }
                placeholder="—"
                className={INPUT_WITH_PLACEHOLDER}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Vendor
            </label>
            <select
              value={newTask.vendor_id}
              onChange={(e) =>
                setNewTask({ ...newTask, vendor_id: e.target.value })
              }
              className={SELECT_BASE}
            >
              <option value="">None</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={newTask.variable_cost}
              onChange={(e) =>
                setNewTask({ ...newTask, variable_cost: e.target.checked })
              }
              className="w-4 h-4"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Costs vary with each occurrence
            </span>
          </label>
        </div>
        <div className={MODAL_DIVIDER}>
          <button
            onClick={onSave}
            disabled={
              !newTask.title ||
              !newTask.category ||
              (newTask.task_type !== "budget_item" && !newTask.start_date)
            }
            className={`flex-1 ${BUTTON_PRIMARY_DISABLED}`}
          >
            Save
          </button>
          <button
            onClick={onClose}
            className={`flex-1 ${BUTTON_SECONDARY}`}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
