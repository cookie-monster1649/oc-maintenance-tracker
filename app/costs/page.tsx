"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Vendor } from "@/lib/vendors";
import type { LineItem } from "@/lib/line-items";
import type { Task } from "@/lib/tasks";
import { getColorClasses } from "@/lib/colors";
import { getCached, setCached } from "@/lib/cache";
import { useGodMode } from "@/app/contexts/god-mode";
import NewTaskModal from "@/app/components/NewTaskModal";
import NewLineItemModal from "@/app/components/NewLineItemModal";
import EditLineItemModal from "@/app/components/EditLineItemModal";

interface CategoryColor {
  name: string;
  color: string;
}

interface LineItemDisplay {
  type: "task";
  key: string;
  lineItemId: string;
  title: string;
  category: string;
  unitCost: number | null;
  actualCount: number;
  actualTotal: number;
  budgetCount: number;
  budgetTotal: number;
  vendorId: string | null;
}


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
    try {
      const [tasksRes, lineItemsRes, vendorsRes, categoriesRes] = await Promise.all([
        fetch("/api/tasks"),
        fetch("/api/line-items"),
        fetch("/api/vendors"),
        fetch("/api/categories"),
      ]);

      if (!tasksRes.ok || !lineItemsRes.ok || !vendorsRes.ok || !categoriesRes.ok) {
        throw new Error("Failed to fetch data");
      }

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
    } catch (err) {
      console.error("[refreshData] Failed to refresh data:", err);
    }
  }, []);

  // ── Form State ──
  const [addingTask, setAddingTask] = useState(false);
  const [creatingLineItem, setCreatingLineItem] = useState(false);
  const [editingLineItem, setEditingLineItem] = useState<LineItem | null>(null);

  // Fetch data on mount and when refreshData callback changes.
  // refreshData is memoized with useCallback but triggers setState internally.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshData();
  }, [refreshData]);

  // ── Budget Calculations ──
  // Build line items with budget vs actual totals.
  const { start, end, label } = fyRange(fy);
  const daysInFY = daysInRange(start, end);

  // Filter tasks by FY
  const inFY_tasks = tasks.filter((t) => fyForDate(t.start_date) === fy);

  // Group tasks by line_item_id
  const tasksByLineItem = new Map<string, Task[]>();
  for (const t of inFY_tasks) {
    if (!tasksByLineItem.has(t.line_item_id)) {
      tasksByLineItem.set(t.line_item_id, []);
    }
    tasksByLineItem.get(t.line_item_id)!.push(t);
  }

  // Build display line items — include all non-archived line items so users can
  // click into them and create tasks, even if they have no tasks or budget yet.
  const displayLineItems: LineItemDisplay[] = [];

  const lineItemIdsToShow = new Set([
    ...tasksByLineItem.keys(),
    ...lineItems.filter((li) => !li.archived).map((li) => li.id),
  ]);

  for (const lineItemId of lineItemIdsToShow) {
    const lineItem = lineItems.find((li) => li.id === lineItemId);
    if (!lineItem) continue;

    const taskList = tasksByLineItem.get(lineItemId) ?? [];
    const completed = taskList.filter((t) => t.status === "Completed");
    const actualTotal = completed.reduce(
      (s, t) => s + (t.actual_cost ?? t.estimated_cost ?? 0),
      0,
    );

    // Budget calculation:
    // - If fy_budget is set on lineItem, use that
    // - Otherwise, calculate from tasks: (estimated_cost × occurrences) for recurring, or just estimated_cost for once-off
    let budgetTotal = 0;
    let budgetCount = 0;
    let unitCost: number | null = null;

    if (lineItem.fy_budget !== null) {
      budgetTotal = lineItem.fy_budget;
      budgetCount = 1;
      unitCost = lineItem.fy_budget;
    } else if (taskList.length > 0) {
      const representative = taskList[0];
      unitCost = representative.estimated_cost;

      if (representative.frequency && unitCost) {
        budgetCount = occurrencesInRange(representative.frequency, daysInFY);
        budgetTotal = budgetCount * unitCost;
      } else if (unitCost) {
        budgetCount = 1;
        budgetTotal = unitCost;
      }
    }

    displayLineItems.push({
      type: "task",
      key: `lineitem-${lineItemId}`,
      lineItemId,
      title: lineItem.title,
      category: lineItem.category,
      unitCost,
      actualCount: completed.length,
      actualTotal,
      budgetCount,
      budgetTotal,
      vendorId: lineItem.vendor_id,
    });
  }

  const sortedLineItems = [...displayLineItems].sort((a, b) =>
    a.category.localeCompare(b.category) || a.title.localeCompare(b.title),
  );

  const grandActual = displayLineItems.reduce((s, l) => s + l.actualTotal, 0);
  const grandBudget = displayLineItems.reduce((s, l) => s + l.budgetTotal, 0);

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
              <>
                <button
                  onClick={() => setCreatingLineItem(true)}
                  className="border border-gray-200 dark:border-gray-700 px-3 py-1.5 rounded-md text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  New line item
                </button>
                <button
                  onClick={() => setAddingTask(true)}
                  className="border border-gray-200 dark:border-gray-700 px-3 py-1.5 rounded-md text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Add task
                </button>
              </>
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
                    <td className="py-2 px-3 font-medium break-words">
                      <Link
                        href={`/line-items/${item.lineItemId}`}
                        className="text-gray-900 dark:text-gray-100 hover:underline"
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
                          onClick={() => {
                            const lineItem = lineItems.find((li) => li.id === item.lineItemId);
                            if (lineItem) setEditingLineItem(lineItem);
                          }}
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
                  <td colSpan={3} className="pt-4 pb-3 px-3 font-bold">
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

      <NewLineItemModal
        isOpen={creatingLineItem}
        categories={categories}
        categoryColors={categoryColors}
        vendors={vendors}
        onSave={() => {
          setCreatingLineItem(false);
          refreshData();
        }}
        onClose={() => setCreatingLineItem(false)}
      />

      {editingLineItem && (
        <EditLineItemModal
          isOpen={true}
          lineItem={editingLineItem}
          categories={categories}
          vendors={vendors}
          onSave={() => {
            setEditingLineItem(null);
            refreshData();
          }}
          onClose={() => setEditingLineItem(null)}
        />
      )}

      <NewTaskModal
        isOpen={addingTask}
        lineItems={lineItems}
        categories={categories}
        vendors={vendors}
        onSave={() => {
          setAddingTask(false);
          refreshData();
        }}
        onClose={() => setAddingTask(false)}
      />
    </>
  );
}
