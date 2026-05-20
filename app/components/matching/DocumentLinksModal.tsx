"use client";

import { useEffect, useState } from "react";
import { TaskCard } from "@/app/components/TaskCard";
import type { Task as TaskCardTask, LineItem as TaskCardLineItem, Vendor as TaskCardVendor } from "@/app/components/TaskCard";
import { getColorClasses } from "@/lib/colors";

interface LinkedVendor {
  id: string;
  name: string;
  service_type: string;
  categories: string[];
}

interface LinkedLineItem {
  id: string;
  title: string;
  description: string;
  category: string;
}

interface LinksData {
  tasks: Array<TaskCardTask & { line_item: TaskCardLineItem | null }>;
  lineItems: LinkedLineItem[];
  vendors: LinkedVendor[];
  categoryColors: Record<string, string>;
}

interface DocumentLinksModalProps {
  docId: number;
  docTitle: string;
  docUrl: string;
  allVendors: TaskCardVendor[];
  onAddLink: () => void;
  onClose: () => void;
  onUnlinked?: () => void;
}

export function DocumentLinksModal({
  docId,
  docTitle,
  docUrl,
  allVendors,
  onAddLink,
  onClose,
  onUnlinked,
}: DocumentLinksModalProps) {
  const [data, setData] = useState<LinksData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchLinks = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/documents/${docId}/links`);
      if (res.ok) {
        setData(await res.json());
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLinks();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId]);

  const unlinkTask = async (taskId: string) => {
    await fetch(`/api/tasks/${taskId}/documents/${docId}`, { method: "DELETE" });
    onUnlinked?.();
    fetchLinks();
  };

  const unlinkLineItem = async (lineItemId: string) => {
    await fetch(`/api/line-items/${lineItemId}/documents?docId=${docId}`, { method: "DELETE" });
    onUnlinked?.();
    fetchLinks();
  };

  const unlinkVendor = async (vendorId: string) => {
    await fetch(`/api/vendors/${vendorId}/documents?docId=${docId}`, { method: "DELETE" });
    onUnlinked?.();
    fetchLinks();
  };

  const isEmpty =
    !loading &&
    data !== null &&
    data.tasks.length === 0 &&
    data.lineItems.length === 0 &&
    data.vendors.length === 0;

  const categoryColors = data?.categoryColors ?? {};

  return (
    <div className="animate-backdrop fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="animate-modal bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto flex flex-col p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Document links</h2>
          <div className="flex items-center gap-3">
            <a
              href={docUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors flex items-center gap-1"
            >
              View ↗
            </a>
            <button
              onClick={onClose}
              className="text-sm text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-md border border-gray-100 dark:border-gray-700 mb-6">
          <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">Document</p>
          <p className="text-sm font-medium truncate">{docTitle}</p>
        </div>

        {loading ? (
          <div className="py-8 text-center text-sm text-gray-400">Loading...</div>
        ) : isEmpty ? (
          <div className="py-8 text-center text-sm text-gray-400">No links yet.</div>
        ) : (
          <div className="space-y-8">
            {data!.tasks.length > 0 && (
              <section>
                <h3 className="text-[10px] uppercase font-bold tracking-wider text-gray-400 mb-3">
                  Tasks
                </h3>
                <div className="space-y-2">
                  {data!.tasks.map((task) => (
                    <div key={task.id} className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <TaskCard
                          task={task}
                          lineItem={task.line_item ?? undefined}
                          vendors={allVendors}
                          categoryColors={categoryColors}
                          showCategory={true}
                          showVendor={true}
                        />
                      </div>
                      <button
                        onClick={() => unlinkTask(task.id)}
                        className="mt-4 text-[10px] font-bold uppercase tracking-wider text-rose-500 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 shrink-0 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {data!.lineItems.length > 0 && (
              <section>
                <h3 className="text-[10px] uppercase font-bold tracking-wider text-gray-400 mb-3">
                  Line items
                </h3>
                <div className="space-y-2">
                  {data!.lineItems.map((li) => {
                    const colors = getColorClasses(categoryColors[li.category] || "blue");
                    return (
                      <div
                        key={li.id}
                        className="flex items-center justify-between gap-3 py-3 border-b border-gray-100 dark:border-gray-800 last:border-0"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-0.5">
                            <a
                              href={`/line-items/${li.id}`}
                              className="font-medium text-gray-900 dark:text-gray-100 hover:underline text-sm"
                            >
                              {li.title}
                            </a>
                            {li.category && (
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${colors.bg} ${colors.text}`}>
                                {li.category}
                              </span>
                            )}
                          </div>
                          {li.description && (
                            <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{li.description}</p>
                          )}
                        </div>
                        <button
                          onClick={() => unlinkLineItem(li.id)}
                          className="text-[10px] font-bold uppercase tracking-wider text-rose-500 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 shrink-0 transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {data!.vendors.length > 0 && (
              <section>
                <h3 className="text-[10px] uppercase font-bold tracking-wider text-gray-400 mb-3">
                  Vendors
                </h3>
                <div className="space-y-0">
                  {data!.vendors.map((v, i) => (
                    <div
                      key={v.id}
                      className={`flex items-start justify-between gap-4 py-5 ${i < data!.vendors.length - 1 ? "border-b border-gray-100 dark:border-gray-800" : ""}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-3 mb-0.5">
                          <a
                            href={`/vendors/${v.id}`}
                            className="font-medium text-gray-900 dark:text-gray-100 hover:underline break-words"
                          >
                            {v.name}
                          </a>
                          {v.categories.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {v.categories.map((cat) => {
                                const colors = getColorClasses(categoryColors[cat] || "blue");
                                return (
                                  <span key={cat} className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${colors.bg} ${colors.text}`}>
                                    {cat}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        {v.service_type && (
                          <div className="text-xs font-semibold text-gray-400 dark:text-gray-500">
                            {v.service_type}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => unlinkVendor(v.id)}
                        className="text-[10px] font-bold uppercase tracking-wider text-rose-500 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 shrink-0 transition-colors mt-1"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800 flex gap-3">
          <button
            onClick={onAddLink}
            className="flex-1 text-sm px-4 py-2 rounded-md bg-gray-900 dark:bg-gray-700 text-white hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors font-medium"
          >
            Add link
          </button>
          <button
            onClick={onClose}
            className="text-sm px-4 py-2 rounded-md border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-medium"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
