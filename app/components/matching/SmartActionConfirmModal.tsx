"use client";

import { Document, Task } from "./useDocumentMatching";

interface SmartActionConfirmModalProps {
  doc: Document;
  task: Task | undefined;
  confirmDate: string;
  onConfirmDateChange: (date: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function SmartActionConfirmModal({
  doc,
  task,
  confirmDate,
  onConfirmDateChange,
  onConfirm,
  onCancel,
}: SmartActionConfirmModalProps) {
  return (
    <div className="animate-backdrop fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="animate-modal bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-2xl w-full p-6 my-6">
        <h2 className="text-lg font-bold mb-6 text-gray-900 dark:text-gray-100">
          Confirm Task Completion
        </h2>

        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* Document Details */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h3 className="text-xs uppercase font-bold text-gray-500 dark:text-gray-400 mb-3">
              Document
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-2">
                  {doc.title}
                </p>
              </div>
              {doc.document_type_label && (
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  Type: <span className="font-medium">{doc.document_type_label}</span>
                </div>
              )}
              {doc.created && (
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  Date:{" "}
                  <span className="font-medium">
                    {new Date(doc.created).toLocaleDateString()}
                  </span>
                </div>
              )}
              <a
                href={doc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                View Document ↗
              </a>
            </div>
          </div>

          {/* Task Card */}
          {task && (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <h3 className="text-xs uppercase font-bold text-gray-500 dark:text-gray-400 mb-3">
                Task
              </h3>
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {task.title}
                </p>
                <div className="flex gap-2">
                  <span
                    className={`text-[10px] uppercase font-bold px-2 py-1 rounded ${
                      task.status === "Completed"
                        ? "bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400"
                        : "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400"
                    }`}
                  >
                    {task.status}
                  </span>
                  <span className="text-[10px] text-gray-600 dark:text-gray-400">
                    {task.category}
                  </span>
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  {task.frequency} • Due:{" "}
                  {new Date(task.start_date).toLocaleDateString()}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Date Confirmation */}
        <div className="mb-6 p-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 rounded-md">
          <label className="block text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400 mb-2">
            Completion date
          </label>
          <input
            type="date"
            value={confirmDate}
            onChange={(e) => onConfirmDateChange(e.target.value)}
            className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 text-sm px-4 py-2 rounded-md border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 text-sm px-4 py-2 rounded-md bg-gray-900 dark:bg-gray-700 text-white hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors font-medium"
          >
            Complete & Link
          </button>
        </div>
      </div>
    </div>
  );
}
