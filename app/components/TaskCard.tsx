"use client";

export type Status = "Scheduled" | "In Progress" | "Completed" | "Overdue";
export type Frequency = "Weekly" | "Bi-weekly" | "Monthly" | "Quarterly" | "Semi-Annually" | "Annually";

export interface Task {
  id: string;
  title: string;
  description: string;
  frequency: Frequency;
  status: Status;
  due_date: string;
  last_completed_date: string | null;
  estimated_cost: number | null;
  vendor_id: string | null;
  category: string;
  archived?: boolean;
}

export interface Vendor {
  id: string;
  name: string;
  service_type: string;
}

const STATUS_STYLES: Record<Status, string> = {
  Overdue: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
  "In Progress": "bg-yellow-100 text-yellow-700 dark:bg-amber-950 dark:text-amber-400",
  Scheduled: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  Completed: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
};

export function TaskCard({
  task,
  vendors,
  onComplete,
  completing,
}: {
  task: Task;
  vendors: Vendor[];
  onComplete?: (id: string) => void;
  completing?: string | null;
}) {
  const vendor = vendors.find((v) => v.id === task.vendor_id);
  const isCompleted = task.status === "Completed";

  const [day, month] = new Date(task.due_date + "T00:00:00")
    .toLocaleDateString("en-AU", { day: "2-digit", month: "short" })
    .split(" ");

  return (
    <div className={`border rounded-lg p-4 transition-colors ${isCompleted ? "border-gray-100 dark:border-gray-800 opacity-60" : "border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900"}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col items-center justify-center w-12 shrink-0 text-center">
          <span className="text-2xl font-bold leading-none text-gray-900 dark:text-gray-100">{day}</span>
          <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">{month}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <a href={`/tasks/${task.id}`} className={`font-medium hover:underline ${isCompleted ? "line-through text-gray-400 dark:text-gray-500" : "text-gray-900 dark:text-gray-100"}`}>
              {task.title}
            </a>
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-medium">
              {task.category}
            </span>
            {isCompleted && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[task.status]}`}>
                {task.status}
              </span>
            )}
            {vendor && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-400">
                {vendor.name}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">{task.description}</p>
          <div className="flex gap-4 text-xs text-gray-400 dark:text-gray-500 flex-wrap">
            <span>{task.frequency}</span>
            {task.estimated_cost != null && <span>${task.estimated_cost}</span>}
            {isCompleted && task.last_completed_date && (
              <span>Completed {task.last_completed_date}</span>
            )}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          {!isCompleted && onComplete && (
            <button
              onClick={() => onComplete(task.id)}
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
