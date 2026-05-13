"use client";

import { useEffect, useState } from "react";

interface Task {
  id: string;
  title: string;
  frequency: string;
  status: "Scheduled" | "In Progress" | "Completed" | "Overdue";
  due_date: string;
  estimated_cost: number | null;
}

// AUS financial year: 1 Jul – 30 Jun. FY2026 = 1 Jul 2025 – 30 Jun 2026.
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
  const daysInRange = days;
  switch (freq) {
    case "Weekly": return Math.round((daysInRange / 7) * (7 / 7));
    case "Bi-weekly": return Math.round((daysInRange / 14) * (7 / 7));
    case "Monthly": return Math.round((daysInRange / 30.44) * (7 / 7));
    case "Quarterly": return Math.round((daysInRange / 91.31) * (7 / 7));
    case "Semi-Annually": return Math.round((daysInRange / 182.63) * (7 / 7));
    case "Annually": return Math.round((daysInRange / daysPerYear) * (7 / 7));
    default: return 0;
  }
}

function fmt(n: number): string {
  return n.toLocaleString("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 });
}

interface LineItem {
  title: string;
  frequency: string;
  unitCost: number | null;
  actualCount: number;
  actualTotal: number;
  budgetCount: number;
  budgetTotal: number;
  all: Task[];
}

export default function CostsPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [fy, setFy] = useState<number | null>(null);
  const [availableFYs, setAvailableFYs] = useState<number[]>([]);

  useEffect(() => {
    fetch("/api/tasks").then((r) => r.json()).then((data: Task[]) => {
      setTasks(data);
      const fys = [...new Set(data.map((t) => fyForDate(t.due_date)))].sort();
      setAvailableFYs(fys);
      const currentFY = fyForDate(new Date().toISOString().split("T")[0]);
      setFy(fys.includes(currentFY) ? currentFY : fys[fys.length - 1]);
    });
  }, []);

  if (!fy) return <main className="max-w-4xl mx-auto px-4 py-10"><p className="text-gray-400">Loading…</p></main>;

  const { start, end, label } = fyRange(fy);
  const inFY = tasks.filter((t) => fyForDate(t.due_date) === fy);
  const daysInFY = daysInRange(start, end);

  // Group by title
  const groups = new Map<string, Task[]>();
  for (const t of inFY) {
    const key = t.title;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }

  const lineItems: LineItem[] = [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([title, tasks]) => {
      const freq = tasks[0].frequency;
      const unitCost = tasks.find((t) => t.estimated_cost)?.estimated_cost ?? null;
      const completed = tasks.filter((t) => t.status === "Completed");
      const actualTotal = completed.reduce((s, t) => s + (t.estimated_cost ?? 0), 0);
      const budgetCount = occurrencesInRange(freq, daysInFY);
      const budgetTotal = unitCost ? budgetCount * unitCost : 0;
      return {
        title,
        frequency: freq,
        unitCost,
        actualCount: completed.length,
        actualTotal,
        budgetCount,
        budgetTotal,
        all: tasks,
      };
    });

  const grandActual = lineItems.reduce((s, l) => s + l.actualTotal, 0);
  const grandBudget = lineItems.reduce((s, l) => s + l.budgetTotal, 0);

  return (
    <main className="max-w-4xl mx-auto px-4 py-10">
      <div className="flex items-start justify-between mb-10">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Costs</h1>
          <p className="text-sm text-gray-500">{label}</p>
        </div>
        <select
          value={fy}
          onChange={(e) => setFy(Number(e.target.value))}
          className="border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
        >
          {availableFYs.map((y) => (
            <option key={y} value={y}>FY{y}</option>
          ))}
        </select>
      </div>

      {inFY.length === 0 ? (
        <p className="text-gray-400 text-sm">No tasks in FY{fy}.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-gray-900">
                <th className="text-left font-bold py-2 px-3">Maintenance</th>
                <th className="text-center font-bold py-2 px-3">Frequency</th>
                <th className="text-right font-bold py-2 px-3">Unit Cost</th>
                <th colSpan={2} className="text-center font-bold py-2 px-3 border-l border-gray-200">Actuals (YTD)</th>
                <th colSpan={2} className="text-center font-bold py-2 px-3 border-l border-gray-200">Budget (FY)</th>
              </tr>
              <tr className="border-b border-gray-200">
                <th></th>
                <th></th>
                <th></th>
                <th className="text-right text-xs font-normal text-gray-400 py-1 px-3">#</th>
                <th className="text-right text-xs font-normal text-gray-400 py-1 px-3">Amount</th>
                <th className="text-right text-xs font-normal text-gray-400 py-1 px-3">#</th>
                <th className="text-right text-xs font-normal text-gray-400 py-1 px-3">Amount</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item) => (
                <tr key={item.title} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-3 font-medium">{item.title}</td>
                  <td className="py-3 px-3 text-center text-gray-500">{item.frequency}</td>
                  <td className="py-3 px-3 text-right text-gray-500 tabular-nums">{item.unitCost ? fmt(item.unitCost) : "—"}</td>
                  <td className="py-3 px-3 text-right tabular-nums border-l border-gray-200">{item.actualCount}</td>
                  <td className="py-3 px-3 text-right tabular-nums font-medium">{fmt(item.actualTotal)}</td>
                  <td className="py-3 px-3 text-right tabular-nums border-l border-gray-200">{item.budgetCount}</td>
                  <td className="py-3 px-3 text-right tabular-nums font-medium">{fmt(item.budgetTotal)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-900">
                <td colSpan={3} className="py-3 px-3 font-bold">Total Maintenance Expenses</td>
                <td className="py-3 px-3 text-right tabular-nums border-l border-gray-200"></td>
                <td className="py-3 px-3 text-right tabular-nums font-bold text-lg">{fmt(grandActual)}</td>
                <td className="py-3 px-3 text-right tabular-nums border-l border-gray-200"></td>
                <td className="py-3 px-3 text-right tabular-nums font-bold text-lg">{fmt(grandBudget)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </main>
  );
}
