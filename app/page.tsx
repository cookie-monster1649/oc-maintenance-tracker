"use client";

import { useEffect, useRef, useState } from "react";
import { TaskCard, Task, Vendor } from "./components/TaskCard";
import { getCached, setCached } from "@/lib/cache";
import { useGodMode } from "./contexts/god-mode";
import { INPUT_BASE } from "@/lib/ui-constants";

type Frequency =
  | "Weekly"
  | "Bi-weekly"
  | "Monthly"
  | "Quarterly"
  | "Semi-Annually"
  | "Annually";

type TaskType = "budget_item" | "once_off" | "recurring";

interface CategoryColor {
  name: string;
  color: string;
}

const FREQUENCIES: Frequency[] = [
  "Weekly",
  "Bi-weekly",
  "Monthly",
  "Quarterly",
  "Semi-Annually",
  "Annually",
];

export default function Home() {
  const { godMode } = useGodMode();
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
  const [completing, setCompleting] = useState<string | null>(null);
  const [promptingCostFor, setPromptingCostFor] = useState<string | null>(null);
  const [costPromptValue, setCostPromptValue] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);
  const [adding, setAdding] = useState(false);
  const addBackdropRef = useRef<HTMLDivElement>(null);
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    task_type: "recurring" as TaskType,
    frequency: "Monthly" as Frequency,
    variable_cost: false,
    start_date: "",
    budget_fy: (() => { const now = new Date(); return now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear(); })(),
    estimated_cost: "",
    vendor_id: "",
    category: "",
  });

  async function fetchAll() {
    const [tasksRes, vendorsRes, categoriesRes] = await Promise.all([
      fetch("/api/tasks"),
      fetch("/api/vendors"),
      fetch("/api/categories"),
    ]);
    const [tasksData, vendorsData, categoriesData] = await Promise.all([
      tasksRes.json(),
      vendorsRes.json(),
      categoriesRes.json(),
    ]);
    setCached("/api/tasks", tasksData);
    setCached("/api/vendors", vendorsData);
    setCached("/api/categories", categoriesData);
    setTasks(
      tasksData.sort((a: Task, b: Task) =>
        (a.start_date || "").localeCompare(b.start_date || ""),
      ),
    );
    setVendors(vendorsData);
    setCategories(categoriesData.map((c: CategoryColor) => c.name));
    setCategoryColors(
      categoriesData.reduce((acc: Record<string, string>, c: CategoryColor) => {
        acc[c.name] = c.color;
        return acc;
      }, {}),
    );
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAll();
  }, []);

  async function addTask() {
    const start_date = newTask.task_type === "budget_item"
      ? `${newTask.budget_fy - 1}-07-01`
      : newTask.start_date;

    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...newTask,
        start_date,
        frequency: newTask.task_type === "recurring" ? newTask.frequency : null,
        estimated_cost: newTask.estimated_cost || null,
        vendor_id: newTask.vendor_id || null,
        no_extrapolate: newTask.task_type !== "recurring",
      }),
    });
    setNewTask({
      title: "",
      description: "",
      task_type: "recurring",
      frequency: "Monthly",
      variable_cost: false,
      start_date: "",
      budget_fy: (() => { const now = new Date(); return now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear(); })(),
      estimated_cost: "",
      vendor_id: "",
      category: "",
    });
    setAdding(false);
    fetchAll();
  }

  async function completeTask(id: string) {
    const task = tasks.find((t) => t.id === id);
    if (task?.variable_cost) {
      setPromptingCostFor(id);
      setCostPromptValue(task.estimated_cost?.toString() || "");
      return;
    }
    await finishCompleteTask(id);
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
    await fetchAll();
    setCompleting(null);
    setPromptingCostFor(null);
    setCostPromptValue("");
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

  const active = tasks.filter((t) => t.status !== "Completed" && !t.archived && t.task_type !== "budget_item");
  const done = tasks.filter((t) => t.status === "Completed" && !t.archived && t.task_type !== "budget_item");

  // Grouping helper to avoid variable reassignment during render
  const groupByYear = (
    items: Task[],
    dateField: "start_date" | "date" = "start_date",
  ) => {
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
  };

  const activeGroups = groupByYear(active);
  const doneSorted = [...done].sort((a, b) =>
    (b.start_date || "").localeCompare(a.start_date || ""),
  );
  const doneGroups = groupByYear(doneSorted);

  return (
    <>
      <main className="animate-page content-container py-10">
        <div className="flex items-start justify-between gap-8 mb-8">
          <div>
            <h1 className="text-2xl font-semibold mb-1 text-gray-900 dark:text-gray-100">
              Tasks
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Active, completed and pending tasks
            </p>
          </div>
          {godMode && (
            <button
              onClick={() => setAdding(true)}
              className="shrink-0 text-sm px-3 py-1.5 rounded-md bg-gray-900 dark:bg-gray-700 text-white hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
            >
              Add task
            </button>
          )}
        </div>

        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-3">
            Active ({active.length})
          </h2>
          <div className="space-y-6">
            {activeGroups.map((group) => (
              <div key={group.year} className="space-y-3">
                {activeGroups.length > 1 && (
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
                  />
                ))}
              </div>
            ))}
          </div>
        </section>

        {done.length > 0 && (
          <section className="mt-10">
            <button
              onClick={() => setShowCompleted((s) => !s)}
              className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-3 flex items-center gap-2 hover:text-gray-600 dark:hover:text-gray-400 transition-colors"
            >
              Completed ({done.length})
              <span
                className={`transition-transform duration-200 ${showCompleted ? "rotate-180" : ""}`}
              >
                ▼
              </span>
            </button>
            <div
              className="grid transition-[grid-template-rows] duration-300 ease-out"
              style={{ gridTemplateRows: showCompleted ? "1fr" : "0fr" }}
            >
              <div className="overflow-hidden">
                <div className="space-y-8">
                  {doneGroups.map((group) => (
                    <div key={group.year} className="space-y-3">
                      {doneGroups.length > 1 && (
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
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      {adding && (
        <div
          ref={addBackdropRef}
          className="animate-backdrop fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === addBackdropRef.current) setAdding(false);
          }}
        >
          <div className="animate-modal bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto flex flex-col p-8">
            <h2 className="text-2xl font-bold mb-8 text-gray-900 dark:text-gray-100 shrink-0">
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
                    setNewTask((f) => ({ ...f, title: e.target.value }))
                  }
                  className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-400"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  value={newTask.description}
                  onChange={(e) =>
                    setNewTask((f) => ({ ...f, description: e.target.value }))
                  }
                  rows={3}
                  className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-400"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Type
                </label>
                <div className="flex gap-3">
                  {(["budget_item", "once_off", "recurring"] as TaskType[]).map((t) => (
                    <label key={t} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="task_type"
                        value={t}
                        checked={newTask.task_type === t}
                        onChange={(e) =>
                          setNewTask((f) => ({ ...f, task_type: e.target.value as TaskType }))
                        }
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {t === "budget_item" ? "Budget item" : t === "once_off" ? "Once-off" : "Recurring"}
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
                        setNewTask((f) => ({ ...f, budget_fy: Number(e.target.value) }))
                      }
                      className={INPUT_BASE}
                    >
                      {[-1, 0, 1, 2].map((offset) => {
                        const now = new Date();
                        const currentFy = now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
                        const fy = currentFy + offset;
                        return <option key={fy} value={fy}>FY{fy}</option>;
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
                        setNewTask((f) => ({ ...f, start_date: e.target.value }))
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
                        setNewTask((f) => ({
                          ...f,
                          frequency: e.target.value as Frequency,
                        }))
                      }
                      className={INPUT_BASE}
                    >
                      {FREQUENCIES.map((f) => (
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
                      setNewTask((f) => ({ ...f, category: e.target.value }))
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
                      setNewTask((f) => ({
                        ...f,
                        estimated_cost: e.target.value,
                      }))
                    }
                    placeholder="—"
                    className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-400"
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
                    setNewTask((f) => ({ ...f, vendor_id: e.target.value }))
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
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newTask.variable_cost}
                  onChange={(e) =>
                    setNewTask((f) => ({ ...f, variable_cost: e.target.checked }))
                  }
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Costs vary with each occurrence
                </span>
              </label>
            </div>
            <div className="flex gap-3 mt-8 pt-6 border-t border-gray-100 dark:border-gray-800 shrink-0">
              <button
                onClick={addTask}
                disabled={
                  !newTask.title || !newTask.category ||
                  (newTask.task_type !== "budget_item" && !newTask.start_date)
                }
                className="flex-1 text-sm px-4 py-2 rounded-md bg-gray-900 dark:bg-gray-700 text-white hover:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-40 transition-colors font-medium"
              >
                Save
              </button>
              <button
                onClick={() => setAdding(false)}
                className="flex-1 text-sm px-4 py-2 rounded-md border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {promptingCostFor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full p-8">
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
                onClick={() => finishCompleteTask(promptingCostFor, Number(costPromptValue) || undefined)}
                className="flex-1 text-sm px-4 py-2 rounded-md bg-gray-900 dark:bg-gray-700 text-white hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors font-medium"
              >
                Complete
              </button>
              <button
                onClick={() => setPromptingCostFor(null)}
                className="flex-1 text-sm px-4 py-2 rounded-md border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
