"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Vendor } from "@/lib/vendors";
import { getColorClasses } from "@/lib/colors";
import { getCached, setCached } from "@/lib/cache";
import { useGodMode } from "@/app/contexts/god-mode";

interface CategoryColor {
  name: string;
  color: string;
}

interface Task {
  id: string;
  series_id: string;
  title: string;
  description: string;
  task_type: "budget_item" | "once_off" | "recurring";
  frequency: string | null;
  variable_cost: boolean;
  status: "Scheduled" | "In Progress" | "Completed" | "Overdue";
  start_date: string;
  estimated_cost: number | null;
  actual_cost: number | null;
  category: string;
  vendor_id: string | null;
}

interface TaskLineItem {
  type: "task";
  key: string;
  id: string;
  title: string;
  category: string;
  frequency: string | null;
  unitCost: number | null;
  actualCount: number;
  actualTotal: number;
  budgetCount: number;
  budgetTotal: number;
  vendorId: string | null;
}

type LineItem = TaskLineItem;


function fyForDate(dateStr: string): number {
  const d = new Date(dateStr + "T00:00:00");
  return d.getMonth() >= 6 ? d.getFullYear() + 1 : d.getFullYear();
}

function fyRange(fy: number): { start: Date; end: Date; label: string } {
  return {
    start: new Date(`${fy - 1}-07-01T00:00:00Z`),
    end: new Date(`${fy}-06-30T23:59:59Z`),
    label: `1 July ${fy - 1} – 30 June ${fy}`,
  };
}

function daysInRange(start: Date, end: Date): number {
  return (
    Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
  );
}

function occurrencesInRange(freq: string | null, days: number): number {
  if (!freq) return 1;
  const daysPerYear = 365.25;
  switch (freq) {
    case "Weekly":
      return Math.round(days / 7);
    case "Bi-weekly":
      return Math.round(days / 14);
    case "Monthly":
      return Math.round(days / 30.44);
    case "Quarterly":
      return Math.round(days / 91.31);
    case "Semi-Annually":
      return Math.round(days / 182.63);
    case "Annually":
      return Math.round(days / daysPerYear);
    default:
      return 0;
  }
}

function fmt(n: number): string {
  return n.toLocaleString("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  });
}

interface EditFormData {
  title?: string;
  description?: string;
  start_date?: string;
  frequency?: string;
  estimated_cost?: number | string;
  category?: string;
  vendor_id?: string;
}

export default function CostsPage() {
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
  const [fy, setFy] = useState<number>(() =>
    fyForDate(new Date().toISOString().split("T")[0]),
  );
  const [availableFYs, setAvailableFYs] = useState<number[]>(() => {
    const cachedTasks = getCached<Task[]>("/api/tasks") ?? [];
    const allDates = cachedTasks.map((t) => t.start_date).filter(Boolean);
    if (!allDates.length) return [];
    return [...new Set(allDates.map((d) => fyForDate(d)))].sort();
  });
  const [adding, setAdding] = useState(false);
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    task_type: "recurring" as "budget_item" | "once_off" | "recurring",
    frequency: "Monthly" as string,
    variable_cost: false,
    start_date: "",
    budget_fy: (() => { const now = new Date(); return now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear(); })(),
    estimated_cost: "",
    vendor_id: "",
    category: "",
  });
  const addBackdropRef = useRef<HTMLDivElement>(null);
  const [editingItem, setEditingItem] = useState<{ data: Task } | null>(null);
  const editBackdropRef = useRef<HTMLDivElement>(null);
  const [editForm, setEditForm] = useState<EditFormData>({});

  useEffect(() => {
    Promise.all([
      fetch("/api/tasks").then((r) => r.json()),
      fetch("/api/vendors").then((r) => r.json()),
      fetch("/api/categories").then((r) => r.json()),
    ]).then(
      ([tasksData, vendorsData, categoriesData]: [Task[], Vendor[], CategoryColor[]]) => {
        setCached("/api/tasks", tasksData);
        setCached("/api/vendors", vendorsData);
        setCached("/api/categories", categoriesData);
        setTasks(tasksData);
        setVendors(vendorsData);
        setCategories(categoriesData.map((c) => c.name));
        setCategoryColors(
          categoriesData.reduce(
            (acc: Record<string, string>, c: CategoryColor) => {
              acc[c.name] = c.color;
              return acc;
            },
            {},
          ),
        );

        const allDates = tasksData.map((t: Task) => t.start_date).filter(Boolean);
        const fys = [...new Set(allDates.map((d: string) => fyForDate(d)))].sort();
        setAvailableFYs(fys);

        if (fys.length > 0) {
          const currentFY = fyForDate(new Date().toISOString().split("T")[0]);
          setFy(fys.includes(currentFY) ? currentFY : fys[fys.length - 1]);
        }
      },
    );
  }, []);

  const addTask = async () => {
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
    const updated = await fetch("/api/tasks").then((r) => r.json());
    setTasks(updated);
  };

  const openEdit = (item: LineItem) => {
    const task = tasks.find((t) => t.id === item.id)!;
    setEditingItem({ data: task });
    setEditForm({
      title: task.title,
      description: task.description || "",
      start_date: task.start_date,
      frequency: task.frequency || "",
      estimated_cost: task.estimated_cost || "",
      category: task.category,
      vendor_id: task.vendor_id || "",
    });
  };

  const closeEdit = () => {
    setEditingItem(null);
    setEditForm({});
  };

  const saveEdit = async () => {
    if (!editingItem) return;
    try {
      await fetch(`/api/tasks/${editingItem.data.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editForm.title,
          description: editForm.description,
          start_date: editForm.start_date,
          frequency: editForm.frequency || null,
          estimated_cost: editForm.estimated_cost
            ? parseFloat(String(editForm.estimated_cost))
            : null,
          category: editForm.category,
          vendor_id: editForm.vendor_id || null,
        }),
      });
      const updated = await fetch("/api/tasks").then((r) => r.json());
      setTasks(updated);
      closeEdit();
    } catch (error) {
      console.error("Failed to save:", error);
    }
  };

  const { start, end, label } = fyRange(fy);
  const daysInFY = daysInRange(start, end);

  // Filter tasks by FY
  const inFY_tasks = tasks.filter((t) => fyForDate(t.start_date) === fy);

  // Group tasks by series_id
  const tasksBySeries = new Map<string, Task[]>();
  for (const t of inFY_tasks) {
    if (!tasksBySeries.has(t.series_id)) {
      tasksBySeries.set(t.series_id, []);
    }
    tasksBySeries.get(t.series_id)!.push(t);
  }

  // Build line items
  const lineItems: LineItem[] = [];

  for (const [seriesId, taskList] of tasksBySeries) {
    const representative = taskList[0];
    const freq = representative.frequency;
    const taskType = representative.task_type;
    const unitCost = taskList.find((t) => t.estimated_cost)?.estimated_cost ?? null;
    const completed = taskList.filter((t) => t.status === "Completed");
    const actualTotal = completed.reduce(
      (s, t) => s + (t.actual_cost ?? t.estimated_cost ?? 0),
      0,
    );

    // Budget calculation depends on task type:
    // - recurring: estimated_cost × occurrences in FY
    // - budget_item / once_off: estimated_cost (fixed, regardless of occurrences)
    const budgetCount = taskType === "recurring" ? occurrencesInRange(freq, daysInFY) : 1;
    const budgetTotal = unitCost ? budgetCount * unitCost : 0;

    lineItems.push({
      type: "task",
      key: `task-${seriesId}`,
      id: representative.id,
      title: representative.title,
      category: representative.category,
      frequency: freq,
      unitCost,
      actualCount: completed.length,
      actualTotal,
      budgetCount,
      budgetTotal,
      vendorId: representative.vendor_id,
    });
  }

  const sortedLineItems = [...lineItems].sort((a, b) =>
    a.category.localeCompare(b.category) || a.title.localeCompare(b.title),
  );

  const grandActual = lineItems.reduce((s, l) => s + l.actualTotal, 0);
  const grandBudget = lineItems.reduce((s, l) => s + l.budgetTotal, 0);

  return (
    <>
      <main className="animate-page content-container py-10">
        <div className="flex items-start justify-between mb-10">
          <div>
            <h1 className="text-2xl font-semibold mb-1">Costs</h1>
            <p className="text-sm text-gray-500">{label}</p>
          </div>
          <div className="flex gap-3">
            <select
              value={fy}
              onChange={(e) => setFy(Number(e.target.value))}
              className="border border-gray-200 dark:border-gray-700 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
            >
              {availableFYs.map((y) => (
                <option key={y} value={y}>
                  FY{y}
                </option>
              ))}
            </select>
            {godMode && (
              <button
                onClick={() => setAdding(true)}
                className="border border-gray-200 dark:border-gray-700 px-3 py-1.5 rounded-md text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Add task
              </button>
            )}
          </div>
        </div>

        {inFY_tasks.length === 0 ? (
          <p className="text-gray-400 text-sm">No items in FY{fy}.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gray-900 dark:border-gray-100">
                  <th className="text-left font-bold py-2 px-3">Item</th>
                  <th className="text-left font-bold py-2 px-3 whitespace-nowrap">
                    Category
                  </th>
                  <th className="text-center font-bold py-2 px-3 whitespace-nowrap w-24">
                    Frequency
                  </th>
                  <th className="text-right font-bold py-2 px-3 whitespace-nowrap">
                    Unit Cost
                  </th>
                  <th
                    colSpan={2}
                    className="text-center font-bold py-2 pl-0 pr-1 border-l border-gray-200"
                  >
                    Budget
                  </th>
                  <th
                    colSpan={2}
                    className="text-center font-bold py-2 pl-0 pr-1 border-l border-gray-200"
                  >
                    Actuals
                  </th>
                  <th className="w-auto"></th>
                </tr>
                <tr className="border-b border-gray-200">
                  <th></th>
                  <th></th>
                  <th></th>
                  <th></th>
                  <th className="text-right text-xs font-normal text-gray-400 py-0 px-1 w-6">
                    #
                  </th>
                  <th className="text-right text-xs font-normal text-gray-400 py-1 pl-1 pr-2 whitespace-nowrap">
                    Amount
                  </th>
                  <th className="text-right text-xs font-normal text-gray-400 py-0 px-1 w-6">
                    #
                  </th>
                  <th className="text-right text-xs font-normal text-gray-400 py-1 pl-1 pr-2 whitespace-nowrap">
                    Amount
                  </th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sortedLineItems.map((item) => (
                  <tr
                    key={item.key}
                    className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <td className="py-2 px-3 font-medium">
                      <Link
                        href={`/tasks/${item.id}`}
                        className="hover:underline"
                      >
                        {item.title}
                      </Link>
                    </td>
                    <td className="py-2 px-3 text-sm">
                      {(() => {
                        const colors = getColorClasses(
                          categoryColors[item.category] || "blue",
                        );
                        return (
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-xs ${colors.bg} ${colors.text}`}
                          >
                            {item.category}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="py-2 px-3 text-center text-gray-500 text-xs whitespace-nowrap w-24">
                      {item.frequency || "—"}
                    </td>
                    <td className="py-2 px-3 text-right text-gray-500 tabular-nums whitespace-nowrap">
                      {item.unitCost ? fmt(item.unitCost) : "—"}
                    </td>
                    <td className="py-2 px-1 text-right tabular-nums border-l border-gray-200">
                      {item.budgetCount}
                    </td>
                    <td className="py-2 pl-0 pr-2 text-right tabular-nums font-medium whitespace-nowrap">
                      {fmt(item.budgetTotal)}
                    </td>
                    <td className="py-2 px-1 text-right tabular-nums border-l border-gray-200">
                      {item.actualCount}
                    </td>
                    <td className="py-2 pl-0 pr-2 text-right tabular-nums font-medium whitespace-nowrap">
                      {fmt(item.actualTotal)}
                    </td>
                    <td className="py-2 pl-1 pr-0 text-center">
                      {godMode && (
                        <button
                          onClick={() => openEdit(item)}
                          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                          ✎
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-900 dark:border-gray-100">
                  <td colSpan={4} className="pt-4 pb-3 px-3 font-bold">
                    Total
                  </td>
                  <td className="border-l border-gray-200 pt-4 pb-3 px-0"></td>
                  <td className="pt-4 pb-3 pl-0 pr-2 text-right tabular-nums font-bold text-lg">
                    {fmt(grandBudget)}
                  </td>
                  <td className="border-l border-gray-200 pt-4 pb-3 px-0"></td>
                  <td className="pt-4 pb-3 pl-0 pr-2 text-right tabular-nums font-bold text-lg">
                    {fmt(grandActual)}
                  </td>
                  <td className="pl-1 pr-0"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </main>

      {editingItem && (
        <div
          ref={editBackdropRef}
          className="animate-backdrop fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === editBackdropRef.current) closeEdit();
          }}
        >
          <div className="animate-modal bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto flex flex-col p-8">
            <h2 className="text-2xl font-bold mb-8 text-gray-900 dark:text-gray-100 shrink-0">
              Edit Task
            </h2>
            <div className="space-y-5 flex-1">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Title
                </label>
                <input
                  value={editForm.title ?? ""}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, title: e.target.value }))
                  }
                  className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-400"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  value={editForm.description ?? ""}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, description: e.target.value }))
                  }
                  rows={2}
                  className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-400"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Due date
                  </label>
                  <input
                    type="date"
                    value={editForm.start_date ?? ""}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, start_date: e.target.value }))
                    }
                    className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Est. cost
                  </label>
                  <input
                    type="number"
                    value={editForm.estimated_cost ?? ""}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, estimated_cost: e.target.value }))
                    }
                    className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-400"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Category
                  </label>
                  <select
                    value={editForm.category ?? ""}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, category: e.target.value }))
                    }
                    className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-400"
                  >
                    {categories.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Vendor
                  </label>
                  <select
                    value={editForm.vendor_id ?? ""}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, vendor_id: e.target.value }))
                    }
                    className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-400"
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
            </div>
            <div className="flex gap-3 mt-8 pt-6 border-t border-gray-100 dark:border-gray-800 shrink-0">
              <button
                onClick={saveEdit}
                className="flex-1 text-sm px-4 py-2 rounded-md bg-gray-900 dark:bg-gray-700 text-white hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors font-medium"
              >
                Save
              </button>
              <button
                onClick={closeEdit}
                className="flex-1 text-sm px-4 py-2 rounded-md border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

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
                  {(["budget_item", "once_off", "recurring"] as const).map((t) => (
                    <label key={t} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="task_type"
                        value={t}
                        checked={newTask.task_type === t}
                        onChange={(e) =>
                          setNewTask((f) => ({ ...f, task_type: e.target.value as typeof t }))
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
                      className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-400"
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
                      className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-400"
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
                        setNewTask((f) => ({ ...f, frequency: e.target.value }))
                      }
                      className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-400"
                    >
                      {["Weekly", "Bi-weekly", "Monthly", "Quarterly", "Semi-Annually", "Annually"].map((f) => (
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
                    className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-400"
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
                  className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-400"
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
    </>
  );
}
