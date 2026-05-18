"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Vendor } from "@/lib/vendors";
import { getColorClasses } from "@/lib/colors";
import { getCached, setCached } from "@/lib/cache";
import { useGodMode } from "@/app/contexts/god-mode";
import EditTaskModal from "@/app/components/EditTaskModal";
import NewTaskModal from "@/app/components/NewTaskModal";
import { useNewTaskForm } from "@/app/hooks/useNewTaskForm";
import { useEditTaskForm } from "@/app/hooks/useEditTaskForm";

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
  // Australian FY starts in July (month 6, since JS months are 0-indexed).
  // Dates in Jul–Dec belong to the next FY (e.g., 2024-07-15 → FY2025).
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
  const daysPerYear = 365.25;  // Account for leap years in long-term averages.
  switch (freq) {
    // Divisors distribute 365.25 days evenly across the frequency.
    // E.g., Monthly = 365.25 / 12 = 30.44 days/occurrence.
    // Rounding gives whole occurrences for budgeting (e.g., 365 days = 12 months).
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

// ── Utility Functions ──
// Fiscal year calculations, budget math, and formatting.

export default function CostsPage() {
  const { godMode } = useGodMode();

  // ── Data & FY State ──
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

  // ── Sync with Server ──
  const refreshData = useCallback(async () => {
    const [tasksData, vendorsData, categoriesData] = await Promise.all([
      fetch("/api/tasks").then((r) => r.json()),
      fetch("/api/vendors").then((r) => r.json()),
      fetch("/api/categories").then((r) => r.json()),
    ]);
    setCached("/api/tasks", tasksData);
    setCached("/api/vendors", vendorsData);
    setCached("/api/categories", categoriesData);
    setTasks(tasksData);
    setVendors(vendorsData);
    setCategories(categoriesData.map((c: CategoryColor) => c.name));
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
    const fys = [...new Set(allDates.map((d: string) => fyForDate(d)))] as number[];
    fys.sort((a, b) => a - b);
    setAvailableFYs(fys);

    if (fys.length > 0) {
      const currentFY = fyForDate(new Date().toISOString().split("T")[0]);
      setFy(fys.includes(currentFY) ? currentFY : fys[fys.length - 1]);
    }
  }, []);

  // ── Form State (via custom hooks) ──
  const [adding, setAdding] = useState(false);
  const [editingItem, setEditingItem] = useState<{ data: Task } | null>(null);

  const newTaskForm = useNewTaskForm(() => {
    setAdding(false);
    refreshData();
  });

  const editTaskForm = useEditTaskForm(() => {
    setEditingItem(null);
    refreshData();
  });

  // Fetch data on mount and when refreshData callback changes.
  // refreshData is memoized with useCallback but triggers setState internally.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshData();
  }, [refreshData]);

  // ── Form Handlers ──
  const handleAddTask = () => {
    newTaskForm.submit();
  };

  const openEdit = (item: LineItem) => {
    const task = tasks.find((t) => t.id === item.id)!;
    setEditingItem({ data: task });
    editTaskForm.setForm({
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
    editTaskForm.reset();
  };

  const handleSaveEdit = async () => {
    if (!editingItem) return;
    await editTaskForm.submit(editingItem.data.id);
  };

  // ── Budget Calculations ──
  // Build line items grouped by task series, with budget vs actual totals.
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

  // ── Render ──
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

      <EditTaskModal
        isOpen={!!editingItem}
        editForm={editTaskForm.form}
        setEditForm={editTaskForm.updateForm}
        categories={categories}
        vendors={vendors}
        onSave={handleSaveEdit}
        onClose={closeEdit}
      />

      <NewTaskModal
        isOpen={adding}
        newTask={newTaskForm.form}
        setNewTask={newTaskForm.updateForm}
        categories={categories}
        vendors={vendors}
        onSave={handleAddTask}
        onClose={() => setAdding(false)}
      />
    </>
  );
}
