"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { TaskCard, Task } from "@/app/components/TaskCard";
import type { LineItem } from "@/lib/line-items";
import { getCached, setCached } from "@/lib/cache";
import { badgeColour } from "@/lib/badge-colour";
import { getColorClasses } from "@/lib/colors";
import { format, parseISO } from "date-fns";
import { useGodMode } from "@/app/contexts/god-mode";
import { MODAL_BACKDROP, MODAL_CONTENT_LG } from "@/lib/ui-constants";
import DetailPageLayout from "@/app/components/DetailPageLayout";
import NewLineItemModal from "@/app/components/NewLineItemModal";
import EditLineItemModal from "@/app/components/EditLineItemModal";
import NewTaskModal from "@/app/components/NewTaskModal";
import { useDocumentMatching } from "@/app/components/matching/useDocumentMatching";
import { MatchDocumentModal } from "@/app/components/matching/MatchDocumentModal";
import { MatchDocumentErrorBoundary } from "@/app/components/matching/MatchDocumentErrorBoundary";
import type { Vendor } from "@/lib/vendors";
import { getTaskPatterns } from "@/lib/detail-page-filters";

interface CategoryColor {
  name: string;
  color: string;
}

function fmt(n: number): string {
  return n.toLocaleString("en-AU", { style: "currency", currency: "AUD" });
}

function groupByYear(
  items: Task[],
  dateField: "start_date" | "date" = "start_date",
) {
  const groups: { year: string; tasks: Task[] }[] = [];
  items.forEach((task) => {
    const date = (
      dateField === "date"
        ? task.last_completed_date || task.start_date
        : task.start_date
    ) || "0000";
    const year = date.split("-")[0];
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.year === year) {
      lastGroup.tasks.push(task);
    } else {
      groups.push({ year, tasks: [task] });
    }
  });
  return groups;
}

export default function LineItemDetailPage() {
  const { godMode } = useGodMode();
  const params = useParams();
  const router = useRouter();
  const lineItemId = params.id as string;

  const [lineItem, setLineItem] = useState<LineItem | null>(null);
  const [tasks, setTasks] = useState<Task[]>(
    () => getCached<Task[]>("/api/tasks") ?? [],
  );
  const [vendors, setVendors] = useState<Vendor[]>(
    () => getCached<Vendor[]>("/api/vendors") ?? [],
  );
  const [categories, setCategories] = useState<string[]>(() =>
    (getCached<CategoryColor[]>("/api/categories") ?? []).map((c) => c.name),
  );
  const [categoryColors, setCategoryColors] = useState<Record<string, string>>(
    () =>
      (getCached<CategoryColor[]>("/api/categories") ?? []).reduce(
        (acc: Record<string, string>, c) => {
          acc[c.name] = c.color;
          return acc;
        },
        {},
      ),
  );

  const [editOpen, setEditOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [completing, setCompleting] = useState<string | null>(null);
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [editingPattern, setEditingPattern] = useState<{
    title: string;
    frequency: string | null;
    estimated_cost: number | null;
    vendor_id: string | null;
    applyToAll: boolean;
    _originalTitle: string;
    _originalFrequency: string | null;
  } | null>(null);
  const [vendorDocs, setVendorDocs] = useState<any[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [matchingDoc, setMatchingDoc] = useState<any | null>(null);
  const [selectedDocTab, setSelectedDocTab] = useState<string>("");

  const menuRef = useRef<HTMLDivElement>(null);
  const editPatternBackdropRef = useRef<HTMLDivElement>(null);

  const fetchAll = useCallback(async () => {
    const [lineItemRes, tasksRes, vendorsRes, categoriesRes] = await Promise.all([
      fetch(`/api/line-items/${lineItemId}`),
      fetch("/api/tasks"),
      fetch("/api/vendors"),
      fetch("/api/categories"),
    ]);

    if (!lineItemRes.ok) {
      router.push("/tasks");
      return;
    }

    const [lineItemData, tasksData, vendorsData, categoriesData] =
      (await Promise.all([
        lineItemRes.json(),
        tasksRes.json(),
        vendorsRes.json(),
        categoriesRes.json(),
      ])) as [LineItem, Task[], Vendor[], CategoryColor[]];

    setCached("/api/tasks", tasksData);
    setCached("/api/vendors", vendorsData);
    setCached("/api/categories", categoriesData);

    setLineItem(lineItemData);
    setTasks(tasksData);
    setVendors(vendorsData);
    setCategories(categoriesData.map((c) => c.name));
    setCategoryColors(
      categoriesData.reduce((acc: Record<string, string>, c: CategoryColor) => {
        acc[c.name] = c.color;
        return acc;
      }, {}),
    );

    // Fetch vendor documents if line item has a vendor
    if (lineItemData.vendor_id) {
      try {
        setLoadingDocs(true);
        const docsRes = await fetch(`/api/vendors/${lineItemData.vendor_id}/documents`);
        if (docsRes.ok) {
          const docs = await docsRes.json();
          setVendorDocs(docs);
        }
      } catch (err) {
        console.error("Failed to fetch vendor documents", err);
      } finally {
        setLoadingDocs(false);
      }
    } else {
      setVendorDocs([]);
    }
  }, [lineItemId, router]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  async function completeTask(id: string) {
    setCompleting(id);
    await fetch(`/api/tasks/${id}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actual_cost: null }),
    });
    await fetchAll();
    setCompleting(null);
  }

  async function handleUnlinkDocument(tId: string, docId: number) {
    if (!confirm("Remove this document link?")) return;

    try {
      const res = await fetch(`/api/tasks/${tId}/documents/${docId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchAll();
      }
    } catch (err) {
      console.error("Unlink failed", err);
    }
  }

  const {
    selectedSeriesId,
    setSelectedSeriesId,
    setSelectedSeriesTitle,
    selectedTaskId,
    setSelectedTaskId,
    createAsOccurrence,
    setCreateAsOccurrence,
    occurrenceDate,
    setOccurrenceDate,
    confirmedDate,
    setConfirmedDate,
    newTaskForm,
    setNewTaskForm,
    handleManualMatch,
    handleManualMatchAndComplete,
    handleSmartAction: hookHandleSmartAction,
    handleCreateAndMatch,
  } = useDocumentMatching({
    tasks,
    defaultVendorId: lineItem?.vendor_id ?? undefined,
    onSuccess: fetchAll,
  });

  const handleSmartAction = (doc: any, action: any) => {
    hookHandleSmartAction(doc, {
      type: action.type,
      taskId: action.taskId,
      taskTitle: action.taskTitle,
    });
  };

  async function handleDelete() {
    if (!confirm(`Delete "${lineItem?.title}"? This cannot be undone.`)) return;
    await fetch(`/api/line-items/${lineItemId}`, { method: "DELETE" });
    router.push("/tasks");
  }

  async function handleArchive() {
    if (!confirm(`Archive "${lineItem?.title}"? It will be hidden but remain in the system.`)) return;
    await fetch(`/api/line-items/${lineItemId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: true }),
    });
    router.push("/tasks");
  }

  async function handleSavePattern() {
    if (!editingPattern || !editingPattern._originalFrequency) return;

    const oldFrequency = editingPattern._originalFrequency;
    const oldTitle = editingPattern._originalTitle;
    const frequencyChanged = editingPattern.frequency !== oldFrequency;

    const matchingTasks = lineItemTasks.filter(
      (t) => t.title === oldTitle && t.frequency === oldFrequency && t.status !== "Completed",
    );

    if (frequencyChanged && matchingTasks.length > 0) {
      const anchor = matchingTasks
        .map((t) => t.start_date)
        .sort()[0];

      await Promise.all(
        matchingTasks.map((t) =>
          fetch(`/api/tasks/${t.id}`, { method: "DELETE" }),
        ),
      );

      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          line_item_id: lineItemId,
          title: editingPattern.title || null,
          frequency: editingPattern.frequency,
          start_date: anchor,
          estimated_cost: editingPattern.estimated_cost,
          vendor_id: editingPattern.vendor_id,
        }),
      });
    } else if (matchingTasks.length > 0) {
      for (const task of matchingTasks) {
        const updateBody: Record<string, unknown> = { vendor_id: editingPattern.vendor_id };
        if (editingPattern.applyToAll) {
          updateBody.title = editingPattern.title;
          updateBody.frequency = editingPattern.frequency;
          updateBody.estimated_cost = editingPattern.estimated_cost;
        }
        await fetch(`/api/tasks/${task.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updateBody),
        });
      }
    }

    setEditingPattern(null);
    await fetchAll();
  }

  if (!lineItem) {
    return (
      <main className="animate-page content-container py-10">
        <p className="text-gray-400">Loading...</p>
      </main>
    );
  }

  const lineItemTasks = tasks.filter((t) => t.line_item_id === lineItemId);
  const completed = lineItemTasks
    .filter((t) => t.status === "Completed")
    .sort((a, b) => (b.start_date || "").localeCompare(a.start_date || ""));
  const upcoming = lineItemTasks
    .filter((t) => t.status !== "Completed")
    .sort((a, b) => (a.start_date || "").localeCompare(b.start_date || ""));

  const actualTotal = completed.reduce(
    (s, t) => s + (t.actual_cost ?? t.estimated_cost ?? 0),
    0,
  );

  const derivedBudgetTotal = lineItem.fy_budget !== null
    ? lineItem.fy_budget
    : lineItemTasks.reduce((s, t) => s + (t.estimated_cost ?? 0), 0);

  const vendor = vendors.find((v) => v.id === lineItem.vendor_id);
  const upcomingGroups = groupByYear(upcoming);
  const completedGroups = groupByYear(completed);

  // Header left content (Budget/Actuals)
  const headerLeftContent = (
    <div>
      <div className="flex gap-12">
        <div className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest min-w-fit">
          FY{new Date().getFullYear() + (new Date().getMonth() >= 6 ? 1 : 0)}
        </div>
        <div>
          <div className="flex items-start gap-12 text-sm">
            <div>
              <div className="text-gray-500 dark:text-gray-400">Budget</div>
              <div className="font-bold text-gray-900 dark:text-gray-100">
                {fmt(derivedBudgetTotal)}
              </div>
            </div>
            <div>
              <div className="text-gray-500 dark:text-gray-400">Actuals</div>
              <div className="font-bold text-gray-900 dark:text-gray-100">
                {fmt(actualTotal)}
              </div>
            </div>
          </div>
          {lineItem.fy_budget === null && (
            <div className="text-xs text-gray-400 dark:text-gray-500 mt-2">Derived from tasks</div>
          )}
        </div>
      </div>
    </div>
  );

  // Header right content (Category/Vendors)
  const usedVendorIds = new Set<string>();
  for (const task of lineItemTasks) {
    const effectiveVendorId = task.vendor_id ?? lineItem.vendor_id;
    if (effectiveVendorId) usedVendorIds.add(effectiveVendorId);
  }
  const usedVendors = Array.from(usedVendorIds)
    .map((id) => vendors.find((v) => v.id === id))
    .filter(Boolean) as Vendor[];

  const headerRightContent = (
    <div className="space-y-4 text-sm">
      <div>
        <div className="text-gray-500 dark:text-gray-400 mb-1">Category</div>
        {(() => {
          const colors = getColorClasses(categoryColors[lineItem.category] || "blue");
          return (
            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${colors.bg} ${colors.text}`}>
              {lineItem.category}
            </span>
          );
        })()}
      </div>
      {usedVendors.length > 0 && (
        <div>
          <div className="text-gray-500 dark:text-gray-400 mb-2">
            {usedVendors.length === 1 ? "Vendor" : "Vendors"}
          </div>
          <ul className="space-y-1">
            {usedVendors.map((v) => (
              <li key={v.id}>
                <a
                  href={`/vendors/${v.id}`}
                  className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                >
                  {v.name}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );

  // Menu button
  const menuButton = godMode ? (
    <div ref={menuRef} className="relative shrink-0 mt-1">
      <button
        onClick={() => setMenuOpen((o) => !o)}
        className="flex items-center justify-center w-8 h-8 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors text-base font-bold"
      >
        ⋮
      </button>
      {menuOpen && (
        <div className="absolute right-0 mt-1 w-40 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-lg z-10">
          <button
            onClick={() => {
              setEditOpen(true);
              setMenuOpen(false);
            }}
            className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-100 dark:border-gray-800"
          >
            Edit
          </button>
          <button
            onClick={handleArchive}
            className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-100 dark:border-gray-800"
          >
            Archive
          </button>
          <button
            onClick={handleDelete}
            className="block w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  ) : null;

  // Task patterns section
  const taskPatternsSection = lineItemTasks.length > 0 ? (
    <div className="mb-12 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-100 dark:border-gray-800">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-4">
        ── Tasks ──
      </h2>
      <div className="space-y-2 pl-5">
        {(() => {
          const patterns = getTaskPatterns(lineItemTasks);
          return Array.from(patterns.values()).map((pattern) => (
            <div key={`${pattern.title}|${pattern.frequency}`} className="flex items-center justify-between text-sm group">
              <span className="text-gray-700 dark:text-gray-300">
                {pattern.title}
                {pattern.frequency && (
                  <>
                    <span className="mx-3 text-gray-400">•</span>
                    <span className="text-gray-500 dark:text-gray-400">{pattern.frequency}</span>
                  </>
                )}
                {pattern.estimated_cost && (
                  <>
                    <span className="mx-3 text-gray-400">•</span>
                    <span className="text-gray-500 dark:text-gray-400">
                      ${pattern.estimated_cost}
                    </span>
                  </>
                )}
              </span>
              {pattern.frequency && (
                <button
                  onClick={() =>
                    setEditingPattern({
                      title: pattern.title,
                      frequency: pattern.frequency,
                      estimated_cost: pattern.estimated_cost,
                      vendor_id: pattern.vendor_id,
                      applyToAll: false,
                      _originalTitle: pattern.title,
                      _originalFrequency: pattern.frequency,
                    })
                  }
                  className="opacity-0 group-hover:opacity-100 text-xs px-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-opacity"
                  title="Edit recurring pattern"
                >
                  ✏
                </button>
              )}
            </div>
          ));
        })()}
      </div>
      {godMode && (
        <button
          onClick={() => setAddTaskOpen(true)}
          className="mt-4 text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          + Add task
        </button>
      )}
    </div>
  ) : null;

  // Tasks and documents section
  const tasksAndDocumentsSection = (
    <section className="grid grid-cols-1 md:grid-cols-2 gap-12">
      <div>
        {upcoming.length > 0 && (
          <div className="mb-12">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-6">
              Upcoming ({upcoming.length})
            </h2>
            <div className="space-y-6">
              {(() => {
                const currentYear = new Date().getFullYear().toString();
                const showYears = upcomingGroups.some((g) => g.year !== currentYear);
                return upcomingGroups.map((group) => (
                  <div key={group.year} className="space-y-3">
                    {showYears && (
                      <div className="pt-2">
                        <span className="text-xs font-bold text-gray-300 dark:text-gray-600 uppercase tracking-widest">
                          {group.year}
                        </span>
                      </div>
                    )}
                    {group.tasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        lineItem={lineItem}
                        vendors={vendors}
                        onCompleteAction={completeTask}
                        completing={completing}
                        categoryColors={categoryColors}
                        onUnlinkDocumentAction={handleUnlinkDocument}
                        showCategory={false}
                      />
                    ))}
                  </div>
                ));
              })()}
            </div>
          </div>
        )}

        {completed.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-6">
              Completed ({completed.length})
            </h2>
            <div className="space-y-8">
              {(() => {
                const currentYear = new Date().getFullYear().toString();
                const showYears = completedGroups.some((g) => g.year !== currentYear);
                return completedGroups.map((group) => (
                  <div key={group.year} className="space-y-3">
                    {showYears && (
                      <div className="pt-2 border-b border-gray-100 dark:border-gray-800 mb-2">
                        <span className="text-xs font-bold text-gray-300 dark:text-gray-600 uppercase tracking-widest">
                          {group.year}
                        </span>
                      </div>
                    )}
                    {group.tasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        lineItem={lineItem}
                        vendors={vendors}
                        onCompleteAction={completeTask}
                        completing={completing}
                        categoryColors={categoryColors}
                        onUnlinkDocumentAction={handleUnlinkDocument}
                        showCategory={false}
                      />
                    ))}
                  </div>
                ));
              })()}
            </div>
          </div>
        )}

        {lineItemTasks.length === 0 && (
          <p className="text-sm text-gray-400 dark:text-gray-500">
            No tasks for this line item. Create one to get started.
          </p>
        )}
      </div>

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-6 flex items-center justify-between">
          Documents
          {loadingDocs && (
            <span className="text-[10px] animate-pulse normal-case font-normal">
              Syncing...
            </span>
          )}
        </h2>
        {vendorDocs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-gray-400 border border-dashed border-gray-100 dark:border-gray-800 rounded-lg">
            <p className="text-xs text-center px-4">
              {lineItem?.vendor_id ? "No documents found." : "No vendor assigned."}
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-lg overflow-hidden shadow-sm">
            <ul className="divide-y divide-gray-50 dark:divide-gray-800">
              {vendorDocs
                .sort((a, b) => (b.created || "").localeCompare(a.created || ""))
                .map((doc) => (
                  <li
                    key={doc.id}
                    className="group p-4 hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span
                            className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${badgeColour(
                              doc.document_type_label,
                            )}`}
                          >
                            {doc.document_type_label || "Document"}
                          </span>
                          <span className="text-[9px] text-gray-400 font-mono">
                            {doc.created ? format(parseISO(doc.created), "dd MMM yyyy") : "—"}
                          </span>
                        </div>
                        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {doc.title}
                        </h3>
                        {!doc.is_matched && doc.smart_actions.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {doc.smart_actions.map((action: any, i: number) => (
                              <button
                                key={i}
                                onClick={() => handleSmartAction(doc, action)}
                                className="text-[10px] px-2 py-1 bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-900 rounded hover:bg-amber-100 dark:hover:bg-amber-900 transition-colors"
                              >
                                {action.type === "MATCH_COMPLETED"
                                  ? `Match to ${format(parseISO(action.dateLabel), "MMM d")} completion`
                                  : <>Match & Complete {action.taskTitle} on <strong>{format(parseISO(action.dateLabel), "MMMM d yyyy")}</strong></>}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors px-2 py-1"
                        >
                          View ↗
                        </a>
                        {!doc.is_matched && (
                          <button
                            onClick={() => setMatchingDoc(doc)}
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline px-2 py-1"
                          >
                            Match
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );

  return (
    <>
      <DetailPageLayout
        backHref="/tasks"
        title={lineItem.title}
        subtitle={lineItem.description}
        menuButton={menuButton}
        headerLeftContent={headerLeftContent}
        headerRightContent={headerRightContent}
        taskPatternsSection={taskPatternsSection}
        tasksAndDocumentsSection={tasksAndDocumentsSection}
      />

      <EditLineItemModal
        isOpen={editOpen}
        lineItem={lineItem}
        categories={categories}
        vendors={vendors}
        onSave={fetchAll}
        onClose={() => setEditOpen(false)}
      />

      {editingPattern && (
        <div
          ref={editPatternBackdropRef}
          className={MODAL_BACKDROP}
          onClick={(e) => {
            if (e.target === editPatternBackdropRef.current) setEditingPattern(null);
          }}
        >
          <div className="animate-modal bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto flex flex-col">
            <h2 className="text-lg font-semibold px-6 py-4 border-b border-gray-200 dark:border-gray-800">
              Edit Task Pattern
            </h2>
            <div className="space-y-4 p-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Title
                </label>
                <input
                  type="text"
                  value={editingPattern.title}
                  onChange={(e) =>
                    setEditingPattern({ ...editingPattern, title: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Frequency
                </label>
                <select
                  value={editingPattern.frequency || ""}
                  onChange={(e) =>
                    setEditingPattern({
                      ...editingPattern,
                      frequency: e.target.value || null,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                >
                  <option value="">Once-off</option>
                  <option value="Weekly">Weekly</option>
                  <option value="Bi-weekly">Bi-weekly</option>
                  <option value="Monthly">Monthly</option>
                  <option value="Quarterly">Quarterly</option>
                  <option value="Semi-Annually">Semi-Annually</option>
                  <option value="Annually">Annually</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Est. Cost ($)
                </label>
                <input
                  type="number"
                  value={editingPattern.estimated_cost ?? ""}
                  onChange={(e) =>
                    setEditingPattern({
                      ...editingPattern,
                      estimated_cost: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Vendor
                </label>
                <select
                  value={editingPattern.vendor_id ?? ""}
                  onChange={(e) =>
                    setEditingPattern({
                      ...editingPattern,
                      vendor_id: e.target.value || null,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                >
                  <option value="">Default ({vendor?.name ?? "none"})</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="applyToAll"
                  checked={editingPattern.applyToAll}
                  onChange={(e) =>
                    setEditingPattern({ ...editingPattern, applyToAll: e.target.checked })
                  }
                  className="w-4 h-4"
                />
                <label
                  htmlFor="applyToAll"
                  className="text-sm text-gray-700 dark:text-gray-300"
                >
                  Apply to all future occurrences
                </label>
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t border-gray-200 dark:border-gray-800">
              <button
                onClick={() => setEditingPattern(null)}
                className="flex-1 px-4 py-2 rounded-md border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePattern}
                className="flex-1 px-4 py-2 rounded-md bg-gray-900 dark:bg-gray-700 text-white hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      <NewTaskModal
        isOpen={addTaskOpen}
        lineItems={[lineItem]}
        categories={categories}
        vendors={vendors}
        onSave={() => {
          setAddTaskOpen(false);
          fetchAll();
        }}
        onClose={() => setAddTaskOpen(false)}
      />

      <MatchDocumentErrorBoundary>
        {matchingDoc && (
          <MatchDocumentModal
            doc={matchingDoc}
            tasks={tasks}
            categories={categories}
            defaultVendorId={lineItem?.vendor_id ?? undefined}
            selectedSeriesId={selectedSeriesId}
            setSelectedSeriesId={setSelectedSeriesId}
            setSelectedSeriesTitle={setSelectedSeriesTitle}
            selectedTaskId={selectedTaskId}
            setSelectedTaskId={setSelectedTaskId}
            createAsOccurrence={createAsOccurrence}
            setCreateAsOccurrence={setCreateAsOccurrence}
            occurrenceDate={occurrenceDate}
            setOccurrenceDate={setOccurrenceDate}
            confirmedDate={confirmedDate}
            setConfirmedDate={setConfirmedDate}
            newTaskForm={newTaskForm}
            setNewTaskForm={setNewTaskForm}
            onManualMatch={handleManualMatch}
            onManualMatchAndComplete={handleManualMatchAndComplete}
            onCreateAndMatch={handleCreateAndMatch}
            onCreateAndMatchComplete={() => {}}
            onClose={() => setMatchingDoc(null)}
          />
        )}
      </MatchDocumentErrorBoundary>
    </>
  );
}
