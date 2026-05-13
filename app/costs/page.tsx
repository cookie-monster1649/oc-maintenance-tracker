"use client";

import { useEffect, useState } from "react";
import { Vendor } from "@/lib/vendors";

interface Task {
  id: string;
  title: string;
  frequency: string;
  status: "Scheduled" | "In Progress" | "Completed" | "Overdue";
  due_date: string;
  estimated_cost: number | null;
  category: string;
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
  return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

function occurrencesInRange(freq: string, days: number): number {
  const daysPerYear = 365.25;
  switch (freq) {
    case "Weekly": return Math.round((days / 7) * (7 / 7));
    case "Bi-weekly": return Math.round((days / 14) * (7 / 7));
    case "Monthly": return Math.round((days / 30.44) * (7 / 7));
    case "Quarterly": return Math.round((days / 91.31) * (7 / 7));
    case "Semi-Annually": return Math.round((days / 182.63) * (7 / 7));
    case "Annually": return Math.round((days / daysPerYear) * (7 / 7));
    default: return 0;
  }
}

function fmt(n: number): string {
  return n.toLocaleString("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 });
}

export default function CostsPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [fy, setFy] = useState<number | null>(null);
  const [availableFYs, setAvailableFYs] = useState<number[]>([]);
  const [showForm, setShowForm] = useState(false);
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
    ]).then(([tasksData, expensesData, vendorsData]: [Task[], Expense[], Vendor[]]) => {
      setTasks(tasksData);
      setExpenses(expensesData);
      setVendors(vendorsData);

      const allDates = [
        ...tasksData.map((t) => t.due_date),
        ...expensesData.map((e) => e.date_paid),
      ];
      const fys = [...new Set(allDates.map((d) => fyForDate(d)))].sort();
      setAvailableFYs(fys);

      const currentFY = fyForDate(new Date().toISOString().split("T")[0]);
      setFy(fys.includes(currentFY) ? currentFY : fys[fys.length - 1]);
    });
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

  const handleDeleteExpense = async (id: string) => {
    try {
      const response = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
      if (response.ok) {
        setExpenses(expenses.filter((e) => e.id !== id));
      }
    } catch (error) {
      console.error("Failed to delete expense:", error);
    }
  };

  if (!fy) return <main className="max-w-6xl mx-auto px-4 py-10"><p className="text-gray-400">Loading…</p></main>;

  const { start, end, label } = fyRange(fy);
  const daysInFY = daysInRange(start, end);

  // Filter tasks and expenses by FY
  const inFY_tasks = tasks.filter((t) => fyForDate(t.due_date) === fy);
  const inFY_expenses = expenses.filter((e) => fyForDate(e.date_paid) === fy);

  // Group tasks by title within each category
  const tasksByCategory = new Map<string, Map<string, Task[]>>();
  for (const t of inFY_tasks) {
    if (!tasksByCategory.has(t.category)) {
      tasksByCategory.set(t.category, new Map());
    }
    const catMap = tasksByCategory.get(t.category)!;
    if (!catMap.has(t.title)) {
      catMap.set(t.title, []);
    }
    catMap.get(t.title)!.push(t);
  }

  // Build line items
  const lineItems: LineItem[] = [];

  // Add task items grouped by category
  const categories = [...tasksByCategory.keys()].sort();
  for (const category of categories) {
    const catMap = tasksByCategory.get(category)!;
    for (const [title, taskList] of catMap) {
      const freq = taskList[0].frequency;
      const unitCost = taskList.find((t) => t.estimated_cost)?.estimated_cost ?? null;
      const completed = taskList.filter((t) => t.status === "Completed");
      const actualTotal = completed.reduce((s, t) => s + (t.estimated_cost ?? 0), 0);
      const budgetCount = occurrencesInRange(freq, daysInFY);
      const budgetTotal = unitCost ? budgetCount * unitCost : 0;

      lineItems.push({
        type: "task",
        key: `task-${category}-${title}`,
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
  }

  // Add expense items grouped by category
  const expensesByCategory = new Map<string, Expense[]>();
  for (const e of inFY_expenses) {
    if (!expensesByCategory.has(e.category)) {
      expensesByCategory.set(e.category, []);
    }
    expensesByCategory.get(e.category)!.push(e);
  }

  for (const [category, expenseList] of expensesByCategory) {
    for (const expense of expenseList) {
      lineItems.push({
        type: "expense",
        key: `expense-${expense.id}`,
        id: expense.id,
        title: expense.description || "(No description)",
        category,
        date_paid: expense.date_paid,
        vendor_id: expense.vendor_id,
        amount: expense.amount,
        description: expense.description,
      });
    }
  }

  const grandActual = lineItems.reduce((s, l) => s + ("actualTotal" in l ? l.actualTotal : l.amount), 0);
  const grandBudget = lineItems.reduce((s, l) => s + ("budgetTotal" in l ? l.budgetTotal : 0), 0);

  return (
    <main className="max-w-6xl mx-auto px-4 py-10">
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
              <option key={y} value={y}>FY{y}</option>
            ))}
          </select>
          <button
            onClick={() => setShowForm(!showForm)}
            className="border border-gray-200 dark:border-gray-700 px-3 py-1.5 rounded-md text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            {showForm ? "Cancel" : "Add expense"}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="mb-8 border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-900">
          <form onSubmit={handleAddExpense} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Date paid</label>
                <input
                  type="date"
                  value={formData.date_paid}
                  onChange={(e) => setFormData({ ...formData, date_paid: e.target.value })}
                  className="w-full border border-gray-200 dark:border-gray-700 rounded px-2 py-1 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Amount ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="0.00"
                  className="w-full border border-gray-200 dark:border-gray-700 rounded px-2 py-1 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                <input
                  type="text"
                  list="categories"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full border border-gray-200 dark:border-gray-700 rounded px-2 py-1 text-sm"
                  required
                />
                <datalist id="categories">
                  {[...new Set(tasks.map((t) => t.category)), ...new Set(expenses.map((e) => e.category))].map((cat) => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Vendor</label>
                <select
                  value={formData.vendor_id}
                  onChange={(e) => setFormData({ ...formData, vendor_id: e.target.value })}
                  className="w-full border border-gray-200 dark:border-gray-700 rounded px-2 py-1 text-sm"
                >
                  <option value="">Select vendor (optional)</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Work details"
                className="w-full border border-gray-200 dark:border-gray-700 rounded px-2 py-1 text-sm"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="border border-gray-200 dark:border-gray-700 px-3 py-1.5 rounded text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="border border-gray-200 dark:border-gray-700 px-3 py-1.5 rounded text-sm bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200"
              >
                Save
              </button>
            </div>
          </form>
        </div>
      )}

      {inFY_tasks.length === 0 && inFY_expenses.length === 0 ? (
        <p className="text-gray-400 text-sm">No items in FY{fy}.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-gray-900">
                <th className="text-left font-bold py-2 px-3">Item</th>
                <th className="text-left font-bold py-2 px-3">Category</th>
                <th className="text-center font-bold py-2 px-3">Frequency</th>
                <th className="text-right font-bold py-2 px-3">Unit Cost</th>
                <th colSpan={2} className="text-center font-bold py-2 px-3 border-l border-gray-200">Actuals</th>
                <th colSpan={2} className="text-center font-bold py-2 px-3 border-l border-gray-200">Budget</th>
                <th className="text-center font-bold py-2 px-3"></th>
              </tr>
              <tr className="border-b border-gray-200">
                <th></th>
                <th></th>
                <th></th>
                <th></th>
                <th className="text-right text-xs font-normal text-gray-400 py-1 px-3">#</th>
                <th className="text-right text-xs font-normal text-gray-400 py-1 px-3">Amount</th>
                <th className="text-right text-xs font-normal text-gray-400 py-1 px-3">#</th>
                <th className="text-right text-xs font-normal text-gray-400 py-1 px-3">Amount</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item) => (
                <tr key={item.key} className="border-b border-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800">
                  {item.type === "task" ? (
                    <>
                      <td className="py-3 px-3 font-medium">{item.title}</td>
                      <td className="py-3 px-3 text-sm text-gray-500">
                        <span className="inline-block px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">{item.category}</span>
                      </td>
                      <td className="py-3 px-3 text-center text-gray-500 text-xs">{item.frequency}</td>
                      <td className="py-3 px-3 text-right text-gray-500 tabular-nums">{item.unitCost ? fmt(item.unitCost) : "—"}</td>
                      <td className="py-3 px-3 text-right tabular-nums border-l border-gray-200">{item.actualCount}</td>
                      <td className="py-3 px-3 text-right tabular-nums font-medium">{fmt(item.actualTotal)}</td>
                      <td className="py-3 px-3 text-right tabular-nums border-l border-gray-200">{item.budgetCount}</td>
                      <td className="py-3 px-3 text-right tabular-nums font-medium">{fmt(item.budgetTotal)}</td>
                      <td className="py-3 px-3"></td>
                    </>
                  ) : (
                    <>
                      <td className="py-3 px-3">
                        <div>
                          <div className="font-medium text-gray-900 dark:text-gray-100">{item.description || "(No description)"}</div>
                          <div className="text-xs text-gray-500">Paid {item.date_paid}</div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-sm">
                        <span className="inline-block px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded text-xs">{item.category}</span>
                      </td>
                      <td className="py-3 px-3 text-center text-xs text-gray-400">—</td>
                      <td className="py-3 px-3"></td>
                      <td className="py-3 px-3 text-right tabular-nums border-l border-gray-200"></td>
                      <td className="py-3 px-3 text-right tabular-nums font-medium">{fmt(item.amount)}</td>
                      <td className="py-3 px-3 border-l border-gray-200"></td>
                      <td className="py-3 px-3"></td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => handleDeleteExpense(item.id)}
                          className="text-xs text-red-600 dark:text-red-400 hover:underline"
                        >
                          Delete
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-900">
                <td colSpan={5} className="py-3 px-3 font-bold">Total Costs</td>
                <td className="py-3 px-3 text-right tabular-nums font-bold text-lg">{fmt(grandActual)}</td>
                <td className="py-3 px-3 border-l border-gray-200"></td>
                <td className="py-3 px-3 text-right tabular-nums font-bold text-lg">{fmt(grandBudget)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </main>
  );
}
