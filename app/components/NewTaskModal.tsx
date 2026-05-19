import { useRef, useState } from "react";
import type { LineItem } from "@/lib/line-items";
import type { Vendor } from "@/lib/vendors";
import {
  INPUT_BASE,
  INPUT_WITH_PLACEHOLDER,
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
  frequency: string; // null (once-off) or "Weekly", "Monthly", etc.
  start_date: string;
  estimated_cost: string;
  line_item_id: string; // FK to LineItem
}

interface NewLineItemInline {
  title: string;
  category: string;
  vendor_id: string;
}

interface NewVendorForm {
  name: string;
  service_type: string;
}

interface NewTaskModalProps {
  isOpen: boolean;
  lineItems: LineItem[];
  categories: string[];
  vendors: Vendor[];
  onSave: () => void;
  onClose: () => void;
  prefilledFrequency?: string;
  prefilledCategory?: string;
  prefilledVendorId?: string;
  allowCreateAndComplete?: boolean;
}

const FREQUENCIES = [
  "Weekly",
  "Bi-weekly",
  "Monthly",
  "Quarterly",
  "Semi-Annually",
  "Annually",
];

export default function NewTaskModal({
  isOpen,
  lineItems,
  categories,
  vendors,
  onSave,
  onClose,
  prefilledFrequency = "Monthly",
  prefilledCategory = "",
  prefilledVendorId = "",
  allowCreateAndComplete = false,
}: NewTaskModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const [newTask, setNewTask] = useState<NewTaskData>({
    title: "",
    description: "",
    frequency: prefilledFrequency,
    start_date: "",
    estimated_cost: "",
    line_item_id: "",
  });
  const [createNewLineItem, setCreateNewLineItem] = useState(false);
  const [newLineItem, setNewLineItem] = useState<NewLineItemInline>({
    title: "",
    category: prefilledCategory,
    vendor_id: prefilledVendorId,
  });
  const [isCreatingVendor, setIsCreatingVendor] = useState(false);
  const [newVendor, setNewVendor] = useState<NewVendorForm>({
    name: "",
    service_type: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [vendorError, setVendorError] = useState("");

  if (!isOpen) return null;

  const selectedLineItem = lineItems.find((li) => li.id === newTask.line_item_id);
  const isValid =
    newTask.start_date &&
    (createNewLineItem
      ? newLineItem.title && newLineItem.category && newTask.line_item_id === ""
      : newTask.line_item_id);

  const handleCreateVendor = async () => {
    if (!newVendor.name) return;
    setIsLoading(true);
    setVendorError("");

    try {
      const res = await fetch("/api/vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newVendor.name,
          service_type: newVendor.service_type || "",
          contact_info: "",
          notes: "",
        }),
      });

      if (!res.ok) throw new Error("Failed to create vendor");
      const created = await res.json();

      setNewLineItem({ ...newLineItem, vendor_id: created.id });
      setNewVendor({ name: "", service_type: "" });
      setIsCreatingVendor(false);
    } catch (err) {
      setVendorError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (complete: boolean = false) => {
    if (!isValid || isLoading) return;
    setIsLoading(true);

    try {
      // If creating new line item, do that first
      let lineItemId = newTask.line_item_id;
      if (createNewLineItem) {
        const liRes = await fetch("/api/line-items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: newLineItem.title,
            description: "",
            category: newLineItem.category,
            vendor_id: newLineItem.vendor_id || null,
            fy_budget: null,
            archived: false,
          }),
        });
        if (!liRes.ok) throw new Error("Failed to create line item");
        const created = await liRes.json();
        lineItemId = created.id;
      }

      // Then create task
      const taskPayload: Record<string, unknown> = {
        title: newTask.title || null,
        description: newTask.description || null,
        frequency: newTask.frequency === "once-off" ? null : newTask.frequency,
        start_date: newTask.start_date,
        estimated_cost: newTask.estimated_cost ? Number(newTask.estimated_cost) : null,
        line_item_id: lineItemId,
        no_extrapolate: newTask.frequency === "once-off",
      };

      if (complete) {
        taskPayload.status = "Completed";
        taskPayload.last_completed_date = newTask.start_date;
      }

      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(taskPayload),
      });

      if (!res.ok) throw new Error("Failed to create task");
      setNewTask({
        title: "",
        description: "",
        frequency: prefilledFrequency,
        start_date: "",
        estimated_cost: "",
        line_item_id: "",
      });
      setCreateNewLineItem(false);
      setNewLineItem({ title: "", category: prefilledCategory, vendor_id: prefilledVendorId });
      onSave();
    } catch (err) {
      console.error("Task creation failed:", err);
      alert(`Error: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      ref={backdropRef}
      className={MODAL_BACKDROP}
      onClick={(e) => {
        if (e.target === backdropRef.current) onClose();
      }}
    >
      <div className={MODAL_CONTENT}>
        <div className="flex items-center justify-between mb-8 shrink-0">
          <h2 className={MODAL_TITLE}>New Task</h2>
          {!isCreatingVendor && (
            <button
              onClick={() => {
                setNewVendor({ name: "", service_type: "" });
                setIsCreatingVendor(true);
              }}
              className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900 px-2 py-1 rounded hover:bg-emerald-50 dark:hover:bg-emerald-950 transition-colors"
            >
              Make vendor
            </button>
          )}
          {isCreatingVendor && (
            <button
              onClick={() => setIsCreatingVendor(false)}
              className="text-xs font-bold text-gray-500 dark:text-gray-400 hover:underline"
            >
              Back to task
            </button>
          )}
        </div>

        <div className="space-y-5 flex-1 overflow-y-auto">
          {isCreatingVendor ? (
            <>
              {vendorError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950 border border-rose-200 dark:border-rose-800 rounded-md">
                  <p className="text-sm text-rose-700 dark:text-rose-400">{vendorError}</p>
                </div>
              )}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Vendor Name *
                  </label>
                  <input
                    value={newVendor.name}
                    onChange={(e) => setNewVendor({ ...newVendor, name: e.target.value })}
                    placeholder="e.g. Acme Services"
                    className={INPUT_BASE}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Service Type
                  </label>
                  <input
                    value={newVendor.service_type}
                    onChange={(e) => setNewVendor({ ...newVendor, service_type: e.target.value })}
                    placeholder="e.g. Electrician"
                    className={INPUT_BASE}
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Title (optional)
                </label>
                <input
                  type="text"
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  placeholder="Task name (or use line item title)"
                  className={INPUT_WITH_PLACEHOLDER}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Description (optional)
                </label>
                <textarea
                  value={newTask.description}
                  onChange={(e) =>
                    setNewTask({ ...newTask, description: e.target.value })
                  }
                  rows={2}
                  className={INPUT_WITH_PLACEHOLDER}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Line Item *
                </label>
                {!createNewLineItem ? (
                  <>
                    <select
                      value={newTask.line_item_id}
                      onChange={(e) =>
                        setNewTask({ ...newTask, line_item_id: e.target.value })
                      }
                      className={INPUT_BASE}
                    >
                      <option value="">Select existing line item</option>
                      {lineItems.map((li) => (
                        <option key={li.id} value={li.id}>
                          {li.title} ({li.category})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setCreateNewLineItem(true)}
                      className="text-sm text-blue-600 dark:text-blue-400 mt-2 hover:underline"
                    >
                      + Create new line item
                    </button>
                  </>
                ) : (
                  <>
                    <div className="space-y-3 p-3 bg-blue-50 dark:bg-blue-950 rounded-md border border-blue-200 dark:border-blue-800">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                          Title *
                        </label>
                        <input
                          type="text"
                          value={newLineItem.title}
                          onChange={(e) =>
                            setNewLineItem({ ...newLineItem, title: e.target.value })
                          }
                          className={INPUT_BASE}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                          Category *
                        </label>
                        <select
                          value={newLineItem.category}
                          onChange={(e) =>
                            setNewLineItem({ ...newLineItem, category: e.target.value })
                          }
                          className={INPUT_BASE}
                        >
                          <option value="">Select category</option>
                          {categories.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                          Vendor (optional)
                        </label>
                        <select
                          value={newLineItem.vendor_id}
                          onChange={(e) =>
                            setNewLineItem({ ...newLineItem, vendor_id: e.target.value })
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
                    <button
                      type="button"
                      onClick={() => setCreateNewLineItem(false)}
                      className="text-sm text-gray-600 dark:text-gray-400 mt-2 hover:underline"
                    >
                      ← Use existing line item
                    </button>
                  </>
                )}
              </div>

              {selectedLineItem && (
                <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded text-sm text-gray-600 dark:text-gray-400">
                  Category: {selectedLineItem.category}
                  {selectedLineItem.vendor_id && ` • ${vendors.find((v) => v.id === selectedLineItem.vendor_id)?.name ?? selectedLineItem.vendor_id}`}
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Frequency *
                </label>
                <select
                  value={newTask.frequency}
                  onChange={(e) =>
                    setNewTask({ ...newTask, frequency: e.target.value })
                  }
                  className={INPUT_BASE}
                >
                  <option value="once-off">Once-off (one time only)</option>
                  {FREQUENCIES.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Start date *
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

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Est. cost ($) (optional)
                </label>
                <input
                  type="number"
                  value={newTask.estimated_cost}
                  onChange={(e) =>
                    setNewTask({ ...newTask, estimated_cost: e.target.value })
                  }
                  placeholder="0"
                  className={INPUT_WITH_PLACEHOLDER}
                />
              </div>
            </>
          )}
        </div>

        <div className={MODAL_DIVIDER}>
          {isCreatingVendor ? (
            <>
              <button
                onClick={() => setIsCreatingVendor(false)}
                className={`flex-1 ${BUTTON_SECONDARY}`}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateVendor}
                disabled={!newVendor.name || isLoading}
                className="flex-1 text-sm px-4 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium"
              >
                Create Vendor
              </button>
            </>
          ) : (
            <>
              <button onClick={onClose} className={`flex-1 ${BUTTON_SECONDARY}`}>
                Cancel
              </button>
              <button
                onClick={() => handleSave(false)}
                disabled={!isValid || isLoading}
                className={`flex-1 ${BUTTON_PRIMARY_DISABLED}`}
              >
                {isLoading ? "Creating..." : "Create Task"}
              </button>
              {allowCreateAndComplete && newTask.frequency === "once-off" && (
                <button
                  onClick={() => handleSave(true)}
                  disabled={!isValid || isLoading}
                  className="flex-1 text-sm px-4 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {isLoading ? "Creating..." : "Create & Complete"}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
