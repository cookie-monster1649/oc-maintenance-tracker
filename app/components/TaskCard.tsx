"use client";

import { getColorClasses } from "@/lib/colors";
import { badgeColour } from "@/lib/badge-colour";

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
  title: string;
  description: string;
  frequency: Frequency;
  status: Status;
  start_date: string;
  last_completed_date: string | null;
  estimated_cost: number | null;
  vendor_id: string | null;
  category: string;
  archived?: boolean;
  documents?: DocumentRef[];
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
  vendors,
  onCompleteAction,
  completing,
  categoryColors,
  onUnlinkDocumentAction,
}: {
  task: Task;
  vendors: Vendor[];
  onCompleteAction?: (id: string) => void;
  completing?: string | null;
  categoryColors?: Record<string, string>;
  onUnlinkDocumentAction?: (taskId: string, docId: number) => void;
}) {
  const vendor = vendors.find((v) => v.id === task.vendor_id);
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
      className={`border rounded-lg p-4 transition-[border-color,box-shadow,opacity,transform] duration-150 ${isCompleted ? "border-gray-100 dark:border-gray-800 opacity-60" : "border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:shadow-sm hover:-translate-y-px"}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col items-center justify-center w-12 shrink-0 text-center">
          <span className="text-2xl font-bold leading-none text-gray-900 dark:text-gray-100">
            {day}
          </span>
          <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
            {month}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <a
              href={`/tasks/${task.id}`}
              className={`font-medium hover:underline ${isCompleted ? "line-through text-gray-400 dark:text-gray-500" : "text-gray-900 dark:text-gray-100"}`}
            >
              {task.title}
            </a>
            {(() => {
              const colors = getCategoryColor(task.category);
              return (
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${colors.bg} ${colors.text} font-medium`}
                >
                  {task.category}
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
            {vendor && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-400">
                {vendor.name}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
            {task.description}
          </p>
          <div className="flex gap-4 text-xs text-gray-400 dark:text-gray-500 flex-wrap">
            <span>{task.frequency}</span>
            {task.estimated_cost != null && <span>${task.estimated_cost}</span>}
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
                  {onUnlinkDocumentAction && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        onUnlinkDocumentAction(task.id, doc.id);
                      }}
                      className="ml-1 p-0.5 text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Unlink document"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M18 6 6 18" />
                        <path d="m6 6 12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          {!isCompleted && onCompleteAction && (
            <button
              onClick={() => onCompleteAction(task.id)}
              disabled={completing === task.id}
              className="text-sm px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 transition-colors"
            >
              {completing === task.id ? "Saving…" : "Mark done"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
