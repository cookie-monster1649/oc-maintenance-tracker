"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { TaskCard, Task } from "../../components/TaskCard";
import NewTaskModal from "@/app/components/NewTaskModal";
import { getColorClasses } from "@/lib/colors";
import { getCached, setCached } from "@/lib/cache";
import { useGodMode } from "@/app/contexts/god-mode";
import type { LineItem } from "@/lib/line-items";
import type { Vendor } from "@/lib/vendors";
import { MODAL_BACKDROP, MODAL_CONTENT, MODAL_CONTENT_SM } from "@/lib/ui-constants";

type Frequency =
  | "Weekly"
  | "Bi-weekly"
  | "Monthly"
  | "Quarterly"
  | "Semi-Annually"
  | "Annually";
const FREQUENCIES: Frequency[] = [
  "Weekly",
  "Bi-weekly",
  "Monthly",
  "Quarterly",
  "Semi-Annually",
  "Annually",
];

interface CategoryColor {
  name: string;
  color: string;
}

function fmt(n: number): string {
  return n.toLocaleString("en-AU", { style: "currency", currency: "AUD" });
}

function fiscalYearLabel(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const fyStart = month >= 7 ? year : year - 1;
  return `FY ${String(fyStart).slice(2)}/${String(fyStart + 1).slice(2)}`;
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

export default function TaskDetailPage() {
  const { godMode } = useGodMode();
  const params = useParams();
  const router = useRouter();
  const taskId = params.id as string;

  const [tasks, setTasks] = useState<Task[]>(
    () => getCached<Task[]>("/api/tasks") ?? [],
  );
  const [lineItems, setLineItems] = useState<LineItem[]>(
    () => getCached<LineItem[]>("/api/line-items") ?? [],
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
  const [addOccurrenceOpen, setAddOccurrenceOpen] = useState(false);
  const [occurrenceForm, setOccurrenceForm] = useState({
    date: new Date().toISOString().split("T")[0],
    completed: false,
    actual_cost: "",
  });
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [completing, setCompleting] = useState<string | null>(null);
  const [promptingCostFor, setPromptingCostFor] = useState<string | null>(null);
  const [costPromptValue, setCostPromptValue] = useState("");
  const [autoLinkedCount, setAutoLinkedCount] = useState(0);
  const [lastAutoLinkedIds, setLastAutoLinkedIds] = useState<number[]>([]);
  const [form, setForm] = useState<Partial<Task>>({});
  const [originalForm, setOriginalForm] = useState<Partial<Task>>({});
  const [renameAllInSeries, setRenameAllInSeries] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const addOccurrenceBackdropRef = useRef<HTMLDivElement>(null);

  const fetchTasks = useCallback(async () => {
    const res = await fetch("/api/tasks");
    const data = await res.json();
    setCached("/api/tasks", data);
    setTasks(data);
  }, []);

  const fetchAll = useCallback(async () => {
    const [tasksRes, lineItemsRes, vendorsRes, categoriesRes] = await Promise.all([
      fetch("/api/tasks"),
      fetch("/api/line-items"),
      fetch("/api/vendors"),
      fetch("/api/categories"),
    ]);
    const [tasksData, lineItemsData, vendorsData, categoriesData] = (await Promise.all([
      tasksRes.json(),
      lineItemsRes.json(),
      vendorsRes.json(),
      categoriesRes.json(),
    ])) as [Task[], LineItem[], Vendor[], CategoryColor[]];
    setCached("/api/tasks", tasksData);
    setCached("/api/line-items", lineItemsData);
    setCached("/api/vendors", vendorsData);
    setCached("/api/categories", categoriesData);
    setTasks(tasksData);
    setLineItems(lineItemsData);
    setVendors(vendorsData);
    setCategories(categoriesData.map((c) => c.name));
    setCategoryColors(
      categoriesData.reduce((acc: Record<string, string>, c: CategoryColor) => {
        acc[c.name] = c.color;
        return acc;
      }, {}),
    );
  }, []);

  async function undoMatch() {
    if (lastAutoLinkedIds.length === 0) return;

    try {
      await Promise.all(
        lastAutoLinkedIds.map((docId) =>
          fetch(`/api/tasks/${taskId}/documents/${docId}`, {
            method: "DELETE",
          }),
        ),
      );
      setAutoLinkedCount(0);
      setLastAutoLinkedIds([]);
      // Fetch without triggering match to prevent immediate re-linking
      const [tasksRes, lineItemsRes, vendorsRes, categoriesRes] = await Promise.all([
        fetch("/api/tasks"),
        fetch("/api/line-items"),
        fetch("/api/vendors"),
        fetch("/api/categories"),
      ]);
      const [tasksData, lineItemsData, vendorsData, categoriesData] = await Promise.all([
        tasksRes.json(),
        lineItemsRes.json(),
        vendorsRes.json(),
        categoriesRes.json(),
      ]);
      setCached("/api/tasks", tasksData);
      setCached("/api/line-items", lineItemsData);
      setCached("/api/vendors", vendorsData);
      setCached("/api/categories", categoriesData);
      setTasks(tasksData);
      setLineItems(lineItemsData);
      setVendors(vendorsData);
      setCategories(categoriesData.map((c: CategoryColor) => c.name));
      setCategoryColors(
        categoriesData.reduce((acc: Record<string, string>, c: CategoryColor) => {
          acc[c.name] = c.color;
          return acc;
        }, {}),
      );
    } catch (err) {
      console.error("Undo match failed", err);
    }
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

  useEffect(() => {
    (async () => {
      await fetchAll();
    })();
  }, [fetchAll]);

  async function completeTask(id: string) {
    const task = tasks.find((t) => t.id === id);
    setPromptingCostFor(id);
    setCostPromptValue(task?.estimated_cost?.toString() || "");
  }

  async function finishCompleteTask(id: string, actualCost?: number) {
    setCompleting(id);
    const body: Record<string, unknown> = {};
    if (actualCost !== undefined) {
      body.actual_cost = actualCost;
    }
    await fetch(`/api/tasks/${id}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    await fetchTasks();
    setCompleting(null);
    setPromptingCostFor(null);
    setCostPromptValue("");
  }

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const currentTask = tasks.find((t) => t.id === taskId);
  if (!currentTask) {
    return (
      <main className="animate-page content-container py-10">
        <p className="text-gray-400">
          {tasks.length === 0 ? "Loading…" : "Task not found"}
        </p>
      </main>
    );
  }

  // Get the lineItem for this task
  const currentLineItem = lineItems.find((li) => li.id === currentTask.line_item_id);

  // Group tasks by line_item_id (replaces old series_id grouping)
  const series = tasks
    .filter((t) => t.line_item_id === currentTask.line_item_id)
    .sort((a, b) => (a.start_date || "").localeCompare(b.start_date || ""));
  const vendor = vendors.find((v) => v.id === currentLineItem?.vendor_id);
  const completed = series
    .filter((t) => t.status === "Completed")
    .sort((a, b) =>
      (b.start_date || "").localeCompare(a.start_date || ""),
    );
  const upcoming = series
    .filter((t) => t.status !== "Completed")
    .sort((a, b) => (a.start_date || "").localeCompare(b.start_date || ""));

  const totalCost = completed.reduce((s, t) => s + (t.estimated_cost ?? 0), 0);
  const avgCost =
    completed.length > 0
      ? completed.reduce((s, t) => s + (t.estimated_cost ?? 0), 0) /
        completed.length
      : 0;

  const openEdit = () => {
    const initial = {
      title: currentTask.title,
      description: currentTask.description,
      frequency: (currentTask.frequency as Frequency) ?? undefined,
      start_date: currentTask.start_date,
      estimated_cost: currentTask.estimated_cost,
    };
    setForm(initial);
    setOriginalForm(initial);
    setEditOpen(true);
  };

  const hasChanges = () => {
    return JSON.stringify(form) !== JSON.stringify(originalForm);
  };

  const closeEdit = () => {
    if (hasChanges() && !confirm("Discard unsaved changes?")) return;
    setEditOpen(false);
  };

  const saveEdit = async () => {
    if (renameAllInSeries && form.title && form.title !== originalForm.title) {
      // Update all tasks in the line item
      await Promise.all(
        series.map((t) =>
          fetch(`/api/tasks/${t.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(form),
          }),
        ),
      );
    } else {
      // Update only this task
      await fetch(`/api/tasks/${taskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
    }
    setEditOpen(false);
    setRenameAllInSeries(false);
    const res = await fetch("/api/tasks");
    const data = await res.json();
    setCached("/api/tasks", data);
    setTasks(data);
  };

  const handleArchive = async () => {
    const futureTasks = series.filter((t) => t.status !== "Completed");
    const count = futureTasks.length;

    if (
      !confirm(
        `Archive this task series? This will hide ${count} future occurrence${
          count === 1 ? "" : "s"
        } but preserve your completion history and cost data.`,
      )
    )
      return;

    // Archive all non-completed tasks in the series
    await Promise.all(
      futureTasks.map((t) =>
        fetch(`/api/tasks/${t.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ archived: true }),
        }),
      ),
    );

    // If we archived the current task, go home. Otherwise just refresh.
    if (currentTask.status !== "Completed") {
      router.push("/");
    } else {
      fetchAll();
      setMenuOpen(false);
    }
  };

  const handleDelete = async () => {
    if (
      !confirm(
        `Delete entire "${currentTask.title}" series? This will remove all occurrences and cannot be undone.`,
      )
    )
      return;
    try {
      await Promise.all(
        series.map((t) =>
          fetch(`/api/tasks/${t.id}`, { method: "DELETE" }),
        ),
      );
      router.push("/");
    } catch (err) {
      console.error("Delete failed:", err);
      alert("Failed to delete task series. Please try again.");
    }
  };

  const handleDeleteOccurrence = async (id: string) => {
    if (!confirm("Delete this occurrence only? Cannot be undone.")) return;
    try {
      const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
      if (res.ok) {
        await fetchAll();
      }
    } catch (err) {
      console.error("Delete occurrence failed:", err);
    }
  };

  const handleAddOccurrence = async () => {
    if (!occurrenceForm.date) {
      alert("Please select a date");
      return;
    }

    try {
      const body: Record<string, unknown> = {
        line_item_id: currentTask.line_item_id,
        title: currentTask.title,
        description: currentTask.description,
        frequency: currentTask.frequency,
        start_date: occurrenceForm.date,
        estimated_cost: currentTask.estimated_cost,
        no_extrapolate: true,
      };

      if (occurrenceForm.completed) {
        body.status = "Completed";
        body.last_completed_date = occurrenceForm.date;
        if (occurrenceForm.actual_cost) {
          body.actual_cost = Number(occurrenceForm.actual_cost);
        } else if (currentTask.estimated_cost) {
          body.actual_cost = currentTask.estimated_cost;
        }
      }

      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setAddOccurrenceOpen(false);
        setOccurrenceForm({
          date: new Date().toISOString().split("T")[0],
          completed: false,
          actual_cost: "",
        });
        await fetchAll();
      }
    } catch (err) {
      console.error("Add occurrence failed:", err);
      alert("Failed to add occurrence");
    }
  };

  return (
    <>
      <main className="animate-page content-container py-10">
        <Link
          href="/"
          className="text-sm text-gray-400 hover:text-gray-600 mb-8 inline-block"
        >
          ← Back
        </Link>

        {autoLinkedCount > 0 && (
          <div className="bg-gray-900 dark:bg-gray-800 text-white px-4 py-3 rounded-lg mb-8 flex items-center justify-between animate-in slide-in-from-top-4 duration-300 shadow-lg">
            <p className="text-sm font-medium">
              Auto-linked {autoLinkedCount} document
              {autoLinkedCount > 1 ? "s" : ""} from Paperless-ngx
            </p>
            <button
              onClick={undoMatch}
              className="text-sm font-bold hover:underline px-2 py-1"
            >
              Undo
            </button>
          </div>
        )}

        <div className="mb-12">
          <div className="flex items-start justify-between gap-6 mb-8">
            <div className="flex-1">
              {currentTask.archived && (
                <div className="mb-2">
                  <span className="inline-block border border-gray-300 dark:border-gray-600 rounded-full px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider text-gray-500 dark:text-gray-400">
                    archived
                  </span>
                </div>
              )}
              <h1 className="text-4xl font-bold mb-3 text-gray-900 dark:text-gray-100">
                {currentTask.title}
              </h1>
              {currentLineItem && (
                <Link
                  href={`/line-items/${currentLineItem.id}`}
                  className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 inline-flex items-center gap-1 mb-3"
                >
                  View line item →
                </Link>
              )}
              <p className="text-base text-gray-600 dark:text-gray-400 leading-relaxed">
                {currentTask.description}
              </p>
            </div>
            {godMode && (
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
                        openEdit();
                        setMenuOpen(false);
                      }}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-100 dark:border-gray-800"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        setAddOccurrenceOpen(true);
                      }}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-100 dark:border-gray-800"
                    >
                      Add occurrence
                    </button>
                    <button
                      onClick={() => {
                        setAddTaskOpen(true);
                        setMenuOpen(false);
                      }}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-100 dark:border-gray-800"
                    >
                      New task
                    </button>
                    {completed.length > 0 && (
                      <button
                        onClick={() => {
                          handleArchive();
                          setMenuOpen(false);
                        }}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-100 dark:border-gray-800"
                      >
                        Archive
                      </button>
                    )}
                    <button
                      onClick={() => {
                        handleDelete();
                        setMenuOpen(false);
                      }}
                      className="block w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950"
                    >
                      Archive line item
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Stats and Details Grid */}
          <div className="grid grid-cols-2 gap-12 mb-12">
            {/* Left: Insights */}
            <div className="space-y-8">
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">
                    Total Completed
                  </div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {completed.length}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">
                    Task Cost
                  </div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {fmt(avgCost)}
                  </div>
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">
                  Actuals {fiscalYearLabel()}
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {fmt(totalCost)}
                </div>
              </div>
            </div>

            {/* Right: Task Details */}
            <div className="space-y-3 text-sm">
              {currentLineItem && (
                <div className="flex justify-between gap-4">
                  <span className="text-gray-500 dark:text-gray-400">
                    Category
                  </span>
                  {(() => {
                    const colors = getColorClasses(
                      categoryColors[currentLineItem.category] || "blue",
                    );
                    return (
                      <span
                        className={`px-2 py-0.5 rounded-full ${colors.bg} ${colors.text} font-medium text-xs`}
                      >
                        {currentLineItem.category}
                      </span>
                    );
                  })()}
                </div>
              )}
              <div className="flex justify-between gap-4">
                <span className="text-gray-500 dark:text-gray-400">
                  Due Date
                </span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {currentTask.start_date}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-gray-500 dark:text-gray-400">
                  Est. Cost
                </span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {currentTask.estimated_cost
                    ? fmt(currentTask.estimated_cost)
                    : "—"}
                </span>
              </div>
              {vendor && (
                <div className="flex justify-between gap-4 pt-3 border-t border-gray-100 dark:border-gray-800">
                  <span className="text-gray-500 dark:text-gray-400">
                    Vendor
                  </span>
                  <a
                    href={`/vendors/${vendor.id}`}
                    className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                  >
                    {vendor.name}
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>

        <section>
          {upcoming.length > 0 && (
            <div className="mb-12">
              <h3 className="text-sm font-semibold uppercase tracking-widest text-gray-400 mb-6">
                Upcoming
              </h3>
              <div className="space-y-6">
                {(() => {
                  const upcomingGroups = groupByYear(upcoming);
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
                          vendors={vendors}
                          onCompleteAction={completeTask}
                          completing={completing}
                          categoryColors={categoryColors}
                          onUnlinkDocumentAction={handleUnlinkDocument}
                          onDeleteOccurrenceAction={handleDeleteOccurrence}
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
              <h3 className="text-sm font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-6">
                Completion History
              </h3>
              <div className="space-y-8">
                {(() => {
                  const completedGroups = groupByYear(completed);
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
                          vendors={vendors}
                          onCompleteAction={completeTask}
                          completing={completing}
                          categoryColors={categoryColors}
                          onUnlinkDocumentAction={handleUnlinkDocument}
                          onDeleteOccurrenceAction={handleDeleteOccurrence}
                        />
                      ))}
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}

          {upcoming.length === 0 && completed.length === 0 && (
            <div className="border rounded-lg p-4 border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
              <p className="text-sm text-gray-400 dark:text-gray-500">No occurrences logged</p>
            </div>
          )}
        </section>
      </main>

      {editOpen && (
        <div
          ref={backdropRef}
          className={MODAL_BACKDROP}
          onClick={(e) => {
            if (e.target === backdropRef.current) closeEdit();
          }}
        >
          <div className={MODAL_CONTENT}>
            <h2 className="text-2xl font-bold mb-8 text-gray-900 dark:text-gray-100 shrink-0">
              Edit Task
            </h2>
            <div className="space-y-5 flex-1 overflow-y-auto">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Title
                </label>
                <input
                  value={form.title ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, title: e.target.value }))
                  }
                  className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-400"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  value={form.description ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                  rows={3}
                  className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-400"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={form.start_date ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, start_date: e.target.value }))
                    }
                    className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Frequency
                  </label>
                  <select
                    value={form.frequency ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        frequency: e.target.value as Frequency,
                      }))
                    }
                    className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-400"
                  >
                    {FREQUENCIES.map((f) => (
                      <option key={f}>{f}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Est. Cost
                </label>
                <input
                  type="number"
                  value={form.estimated_cost ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      estimated_cost: e.target.value
                        ? Number(e.target.value)
                        : null,
                    }))
                  }
                  className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-400"
                />
              </div>
            </div>
            {series.length > 1 && form.title && form.title !== originalForm.title && (
              <div className="flex items-center gap-2 mt-6 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 rounded-md">
                <input
                  type="checkbox"
                  id="renameAllInSeries"
                  checked={renameAllInSeries}
                  onChange={(e) => setRenameAllInSeries(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 cursor-pointer"
                />
                <label htmlFor="renameAllInSeries" className="text-sm text-blue-700 dark:text-blue-400 cursor-pointer">
                  Apply to all future occurrences in this line item
                </label>
              </div>
            )}
            <div className="flex gap-3 mt-8 pt-6 border-t border-gray-100 dark:border-gray-800 shrink-0">
              <button
                onClick={closeEdit}
                className="flex-1 text-sm px-4 py-2 rounded-md border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                className="flex-1 text-sm px-4 py-2 rounded-md bg-gray-900 dark:bg-gray-700 text-white hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors font-medium"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {addOccurrenceOpen && (
        <div
          ref={addOccurrenceBackdropRef}
          className={MODAL_BACKDROP}
          onClick={(e) => {
            if (e.target === addOccurrenceBackdropRef.current) setAddOccurrenceOpen(false);
          }}
        >
          <div className={MODAL_CONTENT_SM}>
            <h2 className="text-2xl font-bold mb-8 text-gray-900 dark:text-gray-100 shrink-0">
              Add Occurrence
            </h2>
            <div className="space-y-5 flex-1">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Date
                </label>
                <input
                  type="date"
                  value={occurrenceForm.date}
                  onChange={(e) =>
                    setOccurrenceForm((f) => ({ ...f, date: e.target.value }))
                  }
                  className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-400"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={occurrenceForm.completed}
                  onChange={(e) =>
                    setOccurrenceForm((f) => ({ ...f, completed: e.target.checked }))
                  }
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Mark as completed
                </span>
              </label>
              {occurrenceForm.completed && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Actual Cost ($)
                  </label>
                  <input
                    type="number"
                    value={occurrenceForm.actual_cost}
                    onChange={(e) =>
                      setOccurrenceForm((f) => ({ ...f, actual_cost: e.target.value }))
                    }
                    placeholder={currentTask.estimated_cost?.toString()}
                    className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-400"
                  />
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-8 pt-6 border-t border-gray-100 dark:border-gray-800 shrink-0">
              <button
                onClick={() => setAddOccurrenceOpen(false)}
                className="flex-1 text-sm px-4 py-2 rounded-md border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleAddOccurrence}
                className="flex-1 text-sm px-4 py-2 rounded-md bg-gray-900 dark:bg-gray-700 text-white hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors font-medium"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {promptingCostFor && (
        <div className={MODAL_BACKDROP}>
          <div className={MODAL_CONTENT_SM}>
            <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-gray-100">
              Enter Actual Cost
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              This task has variable costs. What was the actual cost?
            </p>
            <input
              type="number"
              value={costPromptValue}
              onChange={(e) => setCostPromptValue(e.target.value)}
              placeholder="Enter amount"
              className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-400 mb-6"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setPromptingCostFor(null)}
                className="flex-1 text-sm px-4 py-2 rounded-md border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => finishCompleteTask(promptingCostFor, Number(costPromptValue) || undefined)}
                className="flex-1 text-sm px-4 py-2 rounded-md bg-gray-900 dark:bg-gray-700 text-white hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors font-medium"
              >
                Complete
              </button>
            </div>
          </div>
        </div>
      )}

      <NewTaskModal
        isOpen={addTaskOpen}
        lineItems={lineItems}
        categories={categories}
        vendors={vendors}
        onSave={async () => {
          await fetchAll();
          setAddTaskOpen(false);
        }}
        onClose={() => setAddTaskOpen(false)}
        prefilledFrequency="once-off"
        prefilledCategory={currentLineItem?.category || ""}
        prefilledVendorId={currentLineItem?.vendor_id || ""}
        allowCreateAndComplete={true}
      />

    </>
  );
}
