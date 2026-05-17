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
  frequency: string;
  status: "Scheduled" | "In Progress" | "Completed" | "Overdue";
  start_date: string;
  estimated_cost: number | null;
  category: string;
  vendor_id: string | null;
}

interface Expense {
  id: string;
  date_paid: string;
  amount: number;
  vendor_id: string | null;
  category: string;
  description: string;
}

interface TaskLineItem {
  type: "task";
  key: string;
  id: string;
  title: string;
  category: string;
  frequency: string;
  unitCost: number | null;
  actualCount: number;
  actualTotal: number;
  budgetCount: number;
  budgetTotal: number;
}

interface ExpenseLineItem {
  type: "expense";
  key: string;
  id: string;
  title: string;
  category: string;
  date_paid: string;
  vendor_id: string | null;
  amount: number;
  description: string;
}

type LineItem = TaskLineItem | ExpenseLineItem;

interface VendorGroup {
  vendorId: string | null;
  vendorName: string;
  items: LineItem[];
  groupTotal: number;
}

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

function occurrencesInRange(freq: string, days: number): number {
  const daysPerYear = 365.25;
  switch (freq) {
    case "Weekly":
      return Math.round((days / 7) * (7 / 7));
    case "Bi-weekly":
      return Math.round((days / 14) * (7 / 7));
    case "Monthly":
      return Math.round((days / 30.44) * (7 / 7));
    case "Quarterly":
      return Math.round((days / 91.31) * (7 / 7));
    case "Semi-Annually":
      return Math.round((days / 182.63) * (7 / 7));
    case "Annually":
      return Math.round((days / daysPerYear) * (7 / 7));
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

type EditingItem =
  | { type: "task"; data: Task }
  | { type: "expense"; data: Expense }
  | null;

interface EditFormData {
  title?: string;
  description?: string;
  start_date?: string;
  date_paid?: string;
  frequency?: string;
  estimated_cost?: number | string;
  amount?: number | string;
  category?: string;
  vendor_id?: string;
}

export default function CostsPage() {
  const { godMode } = useGodMode();
  const [tasks, setTasks] = useState<Task[]>(
    () => getCached<Task[]>("/api/tasks") ?? [],
  );
  const [expenses, setExpenses] = useState<Expense[]>(
    () => getCached<Expense[]>("/api/expenses") ?? [],
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
    const cachedExpenses = getCached<Expense[]>("/api/expenses") ?? [];
    const allDates = [
      ...cachedTasks.map((t) => t.start_date),
      ...cachedExpenses.map((e) => e.date_paid),
    ].filter(Boolean);
    if (!allDates.length) return [];
    return [...new Set(allDates.map((d) => fyForDate(d)))].sort();
  });
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<EditingItem>(null);
  const editBackdropRef = useRef<HTMLDivElement>(null);
  const addBackdropRef = useRef<HTMLDivElement>(null);
  const [editForm, setEditForm] = useState<EditFormData>({});
  const [formData, setFormData] = useState({
    date_paid: new Date().toISOString().split("T")[0],
    amount: "",
    vendor_id: "",
    category: "Maintenance",
    description: "",
  });

  useEffect(() => {
    Promise.all([
      fetch("/api/tasks").then((r) => r.json()),
      fetch("/api/expenses").then((r) => r.json()),
      fetch("/api/vendors").then((r) => r.json()),
      fetch("/api/categories").then((r) => r.json()),
    ]).then(
      ([tasksData, expensesData, vendorsData, categoriesData]: [
        Task[],
        Expense[],
        Vendor[],
        CategoryColor[],
      ]) => {
        setCached("/api/tasks", tasksData);
        setCached("/api/expenses", expensesData);
        setCached("/api/vendors", vendorsData);
        setCached("/api/categories", categoriesData);
        setTasks(tasksData);
        setExpenses(expensesData);
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

        const allDates = [
          ...tasksData.map((t) => t.start_date),
          ...expensesData.map((e) => e.date_paid),
        ].filter(Boolean);
        const fys = [...new Set(allDates.map((d) => fyForDate(d)))].sort();
        setAvailableFYs(fys);

        if (fys.length > 0) {
          const currentFY = fyForDate(new Date().toISOString().split("T")[0]);
          setFy(fys.includes(currentFY) ? currentFY : fys[fys.length - 1]);
        }
      },
    );
  }, []);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date_paid: formData.date_paid,
          amount: parseFloat(formData.amount),
          vendor_id: formData.vendor_id || null,
          category: formData.category,
          description: formData.description,
        }),
      });

      if (response.ok) {
        const newExpense = await response.json();
        setExpenses([...expenses, newExpense]);
        setShowForm(false);
        setFormData({
          date_paid: new Date().toISOString().split("T")[0],
          amount: "",
          vendor_id: "",
          category: "Maintenance",
          description: "",
        });
      }
    } catch (error) {
      console.error("Failed to add expense:", error);
    }
  };

  const openEdit = (item: LineItem) => {
    if (item.type === "task") {
      const task = tasks.find((t) => t.id === item.id)!;
      setEditingItem({ type: "task", data: task });
      setEditForm({
        title: task.title,
        description: task.description || "",
        start_date: task.start_date,
        frequency: task.frequency,
        estimated_cost: task.estimated_cost || "",
        category: task.category,
        vendor_id: task.vendor_id || "",
      });
    } else {
      const expense = expenses.find((e) => e.id === item.id)!;
      setEditingItem({ type: "expense", data: expense });
      setEditForm({
        description: expense.description,
        date_paid: expense.date_paid,
        amount: expense.amount,
        category: expense.category,
        vendor_id: expense.vendor_id || "",
        frequency: "",
      });
    }
  };

  const closeEdit = () => {
    setEditingItem(null);
    setEditForm({});
  };

  const saveEdit = async () => {
    if (!editingItem) return;

    try {
      if (editingItem.type === "task") {
        await fetch(`/api/tasks/${editingItem.data.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: editForm.title,
            description: editForm.description,
            start_date: editForm.start_date,
            frequency: editForm.frequency,
            estimated_cost: editForm.estimated_cost
              ? parseFloat(String(editForm.estimated_cost))
              : null,
            category: editForm.category,
            vendor_id: editForm.vendor_id || null,
          }),
        });
        const updated = await fetch("/api/tasks").then((r) => r.json());
        setTasks(updated);
      } else if (editingItem.type === "expense") {
        if (editForm.frequency) {
          await fetch(`/api/expenses/${editingItem.data.id}`, {
            method: "DELETE",
          });
          const newTask = await fetch("/api/tasks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: editForm.description,
              description: editForm.description,
              start_date: editForm.date_paid,
              frequency: editForm.frequency,
              estimated_cost: parseFloat(String(editForm.amount ?? 0)),
              category: editForm.category,
              vendor_id: editForm.vendor_id || null,
              status: "Completed",
            }),
          }).then((r) => r.json());
          setExpenses(expenses.filter((e) => e.id !== editingItem.data.id));
          setTasks([...tasks, newTask]);
        } else {
          await fetch(`/api/expenses/${editingItem.data.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              date_paid: editForm.date_paid,
              amount: parseFloat(String(editForm.amount ?? 0)),
              category: editForm.category,
              vendor_id: editForm.vendor_id || null,
              description: editForm.description,
            }),
          });
          const updated = await fetch("/api/expenses").then((r) => r.json());
          setExpenses(updated);
        }
      }
      closeEdit();
    } catch (error) {
      console.error("Failed to save:", error);
    }
  };

  const { start, end, label } = fyRange(fy);
  const daysInFY = daysInRange(start, end);

  // Filter tasks and expenses by FY
  const inFY_tasks = tasks.filter((t) => fyForDate(t.start_date) === fy);
  const inFY_expenses = expenses.filter((e) => fyForDate(e.date_paid) === fy);

  // Group tasks by series_id
  const tasksBySeries = new Map<string, Task[]>();
  for (const t of inFY_tasks) {
    if (!tasksBySeries.has(t.series_id)) {
      tasksBySeries.set(t.series_id, []);
    }
    tasksBySeries.get(t.series_id)!.push(t);
  }

  // Build line items for all tasks and expenses
  const lineItems: LineItem[] = [];

  // Add task items
  for (const [seriesId, taskList] of tasksBySeries) {
    const freq = taskList[0].frequency;
    const category = taskList[0].category;
    const taskId = taskList[0].id;
    const title = taskList[0].title;
    const unitCost =
      taskList.find((t) => t.estimated_cost)?.estimated_cost ?? null;
    const completed = taskList.filter((t) => t.status === "Completed");
    const actualTotal = completed.reduce(
      (s, t) => s + (t.estimated_cost ?? 0),
      0,
    );
    const budgetCount = occurrencesInRange(freq, daysInFY);
    const budgetTotal = unitCost ? budgetCount * unitCost : 0;

    lineItems.push({
      type: "task",
      key: `task-${seriesId}`,
      id: taskId,
      title,
      category,
      frequency: freq,
      unitCost,
      actualCount: completed.length,
      actualTotal,
      budgetCount,
      budgetTotal,
    });
  }

  // Add expense items
  for (const expense of inFY_expenses) {
    lineItems.push({
      type: "expense",
      key: `expense-${expense.id}`,
      id: expense.id,
      title: expense.description || "(No description)",
      category: expense.category,
      date_paid: expense.date_paid,
      vendor_id: expense.vendor_id,
      amount: expense.amount,
      description: expense.description,
    });
  }

  // Group line items by vendor
  const itemsByVendor = new Map<string | null, LineItem[]>();
  for (const item of lineItems) {
    const vendorId =
      item.type === "task"
        ? (inFY_tasks.find((t) => t.title === item.title)?.vendor_id ?? null)
        : (item.vendor_id ?? null);
    if (!itemsByVendor.has(vendorId)) {
      itemsByVendor.set(vendorId, []);
    }
    itemsByVendor.get(vendorId)!.push(item);
  }

  // Create vendor groups
  const vendorGroups: VendorGroup[] = [];
  const sortedVendorIds = [...itemsByVendor.keys()].sort((a, b) => {
    if (a === null) return 1;
    if (b === null) return -1;
    const vendorA = vendors.find((v) => v.id === a)?.name || "";
    const vendorB = vendors.find((v) => v.id === b)?.name || "";
    return vendorA.localeCompare(vendorB);
  });

  for (const vendorId of sortedVendorIds) {
    const items = itemsByVendor.get(vendorId)!;
    const vendorName = vendorId
      ? vendors.find((v) => v.id === vendorId)?.name || "Unknown Vendor"
      : "No Vendor";
    const groupTotal = items.reduce(
      (s, item) => s + ("actualTotal" in item ? item.actualTotal : item.amount),
      0,
    );

    vendorGroups.push({
      vendorId,
      vendorName,
      items,
      groupTotal,
    });
  }

  const grandActual = lineItems.reduce(
    (s, l) => s + ("actualTotal" in l ? l.actualTotal : l.amount),
    0,
  );
  const grandBudget = lineItems.reduce(
    (s, l) => s + ("budgetTotal" in l ? l.budgetTotal : 0),
    0,
  );

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
                onClick={() => setShowForm(true)}
                className="border border-gray-200 dark:border-gray-700 px-3 py-1.5 rounded-md text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Add expense
              </button>
            )}
          </div>
        </div>

        {inFY_tasks.length === 0 && inFY_expenses.length === 0 ? (
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
                {vendorGroups.flatMap((group) => [
                  <tr
                    key={`header-${group.vendorId || "no-vendor"}`}
                    className="border-t border-gray-200 dark:border-gray-700"
                  >
                    <td
                      colSpan={5}
                      className="pt-5 pb-1 px-3 font-semibold text-gray-900 dark:text-gray-100"
                    >
                      {group.vendorId ? (
                        <Link
                          href={`/vendors/${group.vendorId}`}
                          className="hover:underline"
                        >
                          {group.vendorName}
                        </Link>
                      ) : (
                        group.vendorName
                      )}
                    </td>
                    <td className="pt-5 pb-1 px-0 text-right tabular-nums font-semibold text-gray-500 dark:text-gray-400"></td>
                    <td className="border-l border-gray-200"></td>
                    <td className="pt-5 pb-1 pl-0 pr-2 text-right tabular-nums font-semibold text-gray-500 dark:text-gray-400">
                      {fmt(group.groupTotal)}
                    </td>
                    <td></td>
                  </tr>,
                  ...group.items.map((item) => (
                    <tr
                      key={item.key}
                      className="border-b border-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      {item.type === "task" ? (
                        <>
                          <td className="py-2 px-3 pl-6 font-medium">
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
                            {item.frequency}
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
                        </>
                      ) : (
                        <>
                          <td className="py-2 px-3 pl-6">
                            <div className="font-medium text-gray-900 dark:text-gray-100">
                              {item.description || "(No description)"}
                            </div>
                            <div className="text-xs text-gray-500">
                              Paid {item.date_paid}
                            </div>
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
                          <td className="py-2 px-3 text-center text-xs text-gray-400 whitespace-nowrap">
                            —
                          </td>
                          <td></td>
                          <td className="border-l border-gray-200"></td>
                          <td></td>
                          <td className="border-l border-gray-200"></td>
                          <td className="py-2 pl-0 pr-2 text-right tabular-nums font-medium whitespace-nowrap">
                            {fmt(item.amount)}
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
                        </>
                      )}
                    </tr>
                  )),
                ])}
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

      {showForm && (
        <div
          ref={addBackdropRef}
          className="animate-backdrop fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === addBackdropRef.current) setShowForm(false);
          }}
        >
          <div className="animate-modal bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto flex flex-col p-8">
            <h2 className="text-2xl font-bold mb-8 text-gray-900 dark:text-gray-100 shrink-0">
              New Expense
            </h2>
            <form onSubmit={handleAddExpense} className="flex flex-col flex-1">
              <div className="space-y-5 flex-1">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Description
                  </label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="Work details"
                    className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-400"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Date paid
                    </label>
                    <input
                      type="date"
                      value={formData.date_paid}
                      onChange={(e) =>
                        setFormData({ ...formData, date_paid: e.target.value })
                      }
                      required
                      className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Amount ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.amount}
                      onChange={(e) =>
                        setFormData({ ...formData, amount: e.target.value })
                      }
                      placeholder="0.00"
                      required
                      className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-400"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Category
                    </label>
                    <input
                      type="text"
                      list="add-categories"
                      value={formData.category}
                      onChange={(e) =>
                        setFormData({ ...formData, category: e.target.value })
                      }
                      required
                      className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-400"
                    />
                    <datalist id="add-categories">
                      {[
                        ...new Set([
                          ...tasks.map((t) => t.category),
                          ...expenses.map((e) => e.category),
                        ]),
                      ].map((cat) => (
                        <option key={cat} value={cat} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Vendor
                    </label>
                    <select
                      value={formData.vendor_id}
                      onChange={(e) =>
                        setFormData({ ...formData, vendor_id: e.target.value })
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
                  type="submit"
                  className="flex-1 text-sm px-4 py-2 rounded-md bg-gray-900 dark:bg-gray-700 text-white hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors font-medium"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 text-sm px-4 py-2 rounded-md border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-medium"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
              {editingItem.type === "task" ? "Edit Task" : "Edit Expense"}
            </h2>
            <div className="space-y-5 flex-1">
              {editingItem.type === "task" ? (
                <>
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
                        setEditForm((f) => ({
                          ...f,
                          description: e.target.value,
                        }))
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
                          setEditForm((f) => ({
                            ...f,
                            start_date: e.target.value,
                          }))
                        }
                        className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-400"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Frequency
                      </label>
                      <select
                        value={editForm.frequency ?? ""}
                        onChange={(e) =>
                          setEditForm((f) => ({
                            ...f,
                            frequency: e.target.value,
                          }))
                        }
                        className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-400"
                      >
                        {[
                          "Weekly",
                          "Bi-weekly",
                          "Monthly",
                          "Quarterly",
                          "Semi-Annually",
                          "Annually",
                        ].map((f) => (
                          <option key={f}>{f}</option>
                        ))}
                      </select>
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
                          setEditForm((f) => ({
                            ...f,
                            category: e.target.value,
                          }))
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
                        Est. cost
                      </label>
                      <input
                        type="number"
                        value={editForm.estimated_cost ?? ""}
                        onChange={(e) =>
                          setEditForm((f) => ({
                            ...f,
                            estimated_cost: e.target.value,
                          }))
                        }
                        className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-400"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Vendor
                    </label>
                    <select
                      value={editForm.vendor_id ?? ""}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          vendor_id: e.target.value,
                        }))
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
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Description
                    </label>
                    <input
                      value={editForm.description ?? ""}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          description: e.target.value,
                        }))
                      }
                      className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-400"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Date paid
                      </label>
                      <input
                        type="date"
                        value={editForm.date_paid ?? ""}
                        onChange={(e) =>
                          setEditForm((f) => ({
                            ...f,
                            date_paid: e.target.value,
                          }))
                        }
                        className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-400"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Amount
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={editForm.amount ?? ""}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, amount: e.target.value }))
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
                          setEditForm((f) => ({
                            ...f,
                            category: e.target.value,
                          }))
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
                          setEditForm((f) => ({
                            ...f,
                            vendor_id: e.target.value,
                          }))
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
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Convert to recurring task
                    </label>
                    <select
                      value={editForm.frequency ?? ""}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          frequency: e.target.value,
                        }))
                      }
                      className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-400"
                    >
                      <option value="">Keep as one-off expense</option>
                      {[
                        "Weekly",
                        "Bi-weekly",
                        "Monthly",
                        "Quarterly",
                        "Semi-Annually",
                        "Annually",
                      ].map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}
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
    </>
  );
}
