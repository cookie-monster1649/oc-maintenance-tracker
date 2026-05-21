"use client";

import { getColorClasses } from "@/lib/colors";
import { badgeColour } from "@/lib/badge-colour";
import { useGodMode } from "@/app/contexts/god-mode";

export type Status = "Scheduled" | "In Progress" | "Completed" | "Overdue";
export type Frequency =
  | "Weekly"
  | "Bi-weekly"
  | "Monthly"
  | "Quarterly"
  | "Semi-Annually"
  | "Annually";

export interface DocumentRef {
  id: number;
  title: string;
  document_type_id: number | null;
  document_type_label: string | null;
  created: string;
  url: string;
  auto_linked: boolean;
  linked_at: string;
}

export interface Task {
  id: string;
  line_item_id: string;
  title: string | null;
  description: string | null;
  frequency: Frequency | null;
  status: Status;
  start_date: string;
  end_date: string | null;
  last_completed_date: string | null;
  estimated_cost: number | null;
  actual_cost: number | null;
  archived?: boolean;
  vendor_id?: string | null;
  documents: DocumentRef[];
}

export interface LineItem {
  id: string;
  title: string;
  description: string;
  category: string;
  vendor_id: string | null;
  ocy_entries: Array<{ year: number; budget: number | null }>;
  archived: boolean;
}

export interface Vendor {
  id: string;
  name: string;
  service_type: string;
}

const STATUS_STYLES: Record<Status, string> = {
  Overdue: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
  "In Progress":
    "bg-yellow-100 text-yellow-700 dark:bg-amber-950 dark:text-amber-400",
  Scheduled: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  Completed:
    "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
};

export function TaskCard({
  task,
  lineItem,
  vendors,
  onCompleteAction,
  completing,
  categoryColors,
  onUnlinkDocumentAction,
  onDeleteOccurrenceAction,
  onEditAction,
  showCategory = true,
  showVendor = true,
}: {
  task: Task;
  lineItem?: LineItem;
  vendors: Vendor[];
  onCompleteAction?: (id: string) => void;
  completing?: string | null;
  categoryColors?: Record<string, string>;
  onUnlinkDocumentAction?: (taskId: string, docId: number) => void;
  onDeleteOccurrenceAction?: (id: string) => void;
  onEditAction?: (id: string) => void;
  showCategory?: boolean;
  showVendor?: boolean;
}) {
  const { godMode } = useGodMode();

  // Fallback for pages not yet updated to pass lineItem
  const defaultLineItem: LineItem = {
    id: task.line_item_id,
    title: task.title ?? "Task",
    description: task.description ?? "",
    category: "Uncategorized",
    vendor_id: null,
    ocy_entries: [{ year: 2026, budget: null }],
    archived: task.archived ?? false,
  };
  const resolvedLineItem = lineItem ?? defaultLineItem;

  const effectiveVendorId = task.vendor_id ?? resolvedLineItem.vendor_id;
  const vendor = vendors.find((v) => v.id === effectiveVendorId);
  const isCompleted = task.status === "Completed";

  const getCategoryColor = (category: string): { bg: string; text: string } => {
    const colorName = categoryColors?.[category] || "blue";
    return getColorClasses(colorName);
  };

  const [day, month] = (task.start_date
    ? new Date(task.start_date + "T00:00:00")
        .toLocaleDateString("en-AU", { day: "2-digit", month: "short" })
        .split(" ")
    : ["—", ""]);

  return (
    <div
      className={`border rounded-lg p-4 transition-[border-color,box-shadow,opacity,transform] duration-150 group ${isCompleted ? "border-gray-100 dark:border-gray-800 opacity-60" : "border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:shadow-sm hover:-translate-y-px"}`}
    >
      <div className="flex items-start gap-2 md:gap-4">
        <div className="flex flex-col items-center justify-center w-12 shrink-0 text-center">
          <span className="text-2xl font-bold leading-none text-gray-900 dark:text-gray-100">
            {day}
          </span>
          <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
            {month}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          {/* Title row shares space with action buttons */}
          <div className="flex items-start justify-between gap-2 mb-1">
            <a
              href={`/line-items/${task.line_item_id}`}
              className={`font-medium hover:underline ${isCompleted ? "line-through text-gray-400 dark:text-gray-500" : "text-gray-900 dark:text-gray-100"}`}
            >
              {task.title ?? resolvedLineItem.title}
            </a>
            <div className="flex gap-1 md:gap-2 shrink-0 items-center">
              {!isCompleted && onCompleteAction && godMode && (
                <button
                  onClick={() => onCompleteAction(task.id)}
                  disabled={completing === task.id}
                  className="text-xs md:text-sm px-2 md:px-3 py-1 md:py-1.5 rounded-md border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 transition-colors whitespace-nowrap"
                >
                  {completing === task.id ? "Saving…" : "Mark done"}
                </button>
              )}
              {godMode && onEditAction && (
                <button
                  onClick={() => onEditAction(task.id)}
                  className="text-xs px-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  title={isCompleted ? "Edit and undo completion" : "Edit task"}
                  aria-label={isCompleted ? "Edit and undo completion" : "Edit task"}
                >
                  ✏
                </button>
              )}
              {godMode && onDeleteOccurrenceAction && (
                <button
                  onClick={() => onDeleteOccurrenceAction(task.id)}
                  className="hidden group-hover:flex items-center justify-center w-6 h-6 rounded-md border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900 transition-colors text-xs font-bold"
                  title="Delete this occurrence"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
          {/* Category and status badges — full width below title */}
          {(showCategory || isCompleted) && (
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {showCategory && (() => {
                const colors = getCategoryColor(resolvedLineItem.category);
                return (
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${colors.bg} ${colors.text} font-medium`}
                  >
                    {resolvedLineItem.category}
                  </span>
                );
              })()}
              {isCompleted && (
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[task.status]}`}
                >
                  {task.status}
                </span>
              )}
            </div>
          )}
          {showVendor && vendor && (
            <div className="mb-1">
              <a
                href={`/vendors/${vendor.id}`}
                className="inline-block text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 px-2 py-0.5 rounded transition-colors"
              >
                {vendor.name}
              </a>
            </div>
          )}
          {(task.description ?? resolvedLineItem.description) && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
              {task.description ?? resolvedLineItem.description}
            </p>
          )}
          <div className="flex gap-4 text-xs text-gray-400 dark:text-gray-500 flex-wrap">
            {task.frequency && <span>{task.frequency}</span>}
            {(task.actual_cost != null || task.estimated_cost != null) && (
              <span>
                {isCompleted && task.actual_cost != null
                  ? `Est $${task.estimated_cost ?? 0} / Act $${task.actual_cost}`
                  : `$${task.estimated_cost}`}
              </span>
            )}
            {isCompleted && task.last_completed_date && (
              <span>Completed {task.last_completed_date}</span>
            )}
          </div>
          {task.documents && task.documents.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {task.documents.map((doc) => (
                <div key={doc.id} className="group relative flex items-center">
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-2 py-1 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded text-[11px] hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
                  >
                    <span
                      className={`font-bold uppercase tracking-wider px-1 rounded-xs ${badgeColour(
                        doc.document_type_label,
                      )}`}
                    >
                      {doc.document_type_label || "DOC"}
                    </span>
                    <span className="text-gray-700 dark:text-gray-300 truncate max-w-37.5">
                      {doc.title}
                    </span>
                  </a>
                  {godMode && onUnlinkDocumentAction && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        onUnlinkDocumentAction(task.id, doc.id);
                      }}
                      className="hidden group-hover:inline ml-1 text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors text-xs leading-none h-3 flex items-center"
                      title="Remove document"
                      aria-label="Remove document"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
