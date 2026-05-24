"use client";

import { useEffect, useState } from "react";
import { TaskCard, Task, LineItem } from "@/app/components/TaskCard";
import NewTaskModal from "@/app/components/NewTaskModal";
import { getCached, setCached } from "@/lib/cache";
import { useGodMode } from "@/app/contexts/god-mode";
import type { Vendor } from "@/lib/vendors";

interface CategoryColor {
  name: string;
  color: string;
}

export default function TasksPage() {
  const { godMode } = useGodMode();
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
  const [completing, setCompleting] = useState<string | null>(null);
  const [promptingCostFor, setPromptingCostFor] = useState<string | null>(null);
  const [costPromptValue, setCostPromptValue] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  async function fetchAll() {
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
    setTasks(
      tasksData.sort((a: Task, b: Task) =>
        (a.start_date || "").localeCompare(b.start_date || ""),
      ),
    );
    setLineItems(lineItemsData);
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

  async function completeTask(id: string) {
    const task = tasks.find((t) => t.id === id);
    // Always prompt for actual cost in new model
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

  function handleEditTask(taskId: string) {
    setEditingTaskId(taskId);
  }

  async function handleEditSave(taskId: string, data: Record<string, unknown>) {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        fetchAll();
        setEditingTaskId(null);
      } else {
        throw new Error("Failed to update task");
      }
    } catch (err) {
      console.error("Edit failed", err);
      alert(`Error: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  const active = tasks.filter((t) => t.status !== "Completed" && !t.archived);
  const done = tasks.filter((t) => t.status === "Completed" && !t.archived);

  const ocYearForDate = (dateStr: string): number => {
    const d = new Date(dateStr + "T00:00:00");
    return d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  };

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
      ) || "0000-01-01";
      const ocY = date === "0000-01-01" ? "0000" : `OC-Y${ocYearForDate(date)}`;
      const lastGroup = groups[groups.length - 1];
      if (lastGroup && lastGroup.year === ocY) {
        lastGroup.tasks.push(task);
      } else {
        groups.push({ year: ocY, tasks: [task] });
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
              onClick={() => setIsAddingTask(true)}
              className="shrink-0 text-sm px-3 py-1.5 rounded-md bg-gray-900 dark:bg-gray-700 text-white hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
            >
              New task
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
                {group.tasks.map((task) => {
                  const li = lineItems.find((li) => li.id === task.line_item_id);
                  return (
                    <TaskCard
                      key={task.id}
                      task={task}
                      lineItem={li}
                      vendors={vendors}
                      onCompleteAction={completeTask}
                      completing={completing}
                      categoryColors={categoryColors}
                      onUnlinkDocumentAction={handleUnlinkDocument}
                      onEditAction={handleEditTask}
                    />
                  );
                })}
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
                          onEditAction={handleEditTask}
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

      <NewTaskModal
        isOpen={isAddingTask}
        lineItems={lineItems}
        categories={categories}
        vendors={vendors}
        onSave={() => {
          setIsAddingTask(false);
          fetchAll();
        }}
        onClose={() => setIsAddingTask(false)}
      />

      {editingTaskId && (() => {
        const editingTask = tasks.find((t) => t.id === editingTaskId);
        return (
          <NewTaskModal
            isOpen={!!editingTaskId}
            mode="edit"
            lineItems={lineItems}
            categories={categories}
            vendors={vendors}
            editingData={editingTask}
            onEditSave={(data) => handleEditSave(editingTaskId, data)}
            onSave={() => {
              setEditingTaskId(null);
              fetchAll();
            }}
            onClose={() => setEditingTaskId(null)}
          />
        );
      })()}

      {promptingCostFor && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setPromptingCostFor(null); }}
        >
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full p-8">
            <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-gray-100">
              Enter Actual Cost
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              What was the actual cost for this task?
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
    </>
  );
}
