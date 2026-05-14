"use client";

import { useEffect, useRef, useState } from "react";
import { TaskCard, Task, Vendor } from "./components/TaskCard";
import { getCached, setCached } from "@/lib/cache";

type Frequency =
  | "Weekly"
  | "Bi-weekly"
  | "Monthly"
  | "Quarterly"
  | "Semi-Annually"
  | "Annually";

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
  const [tasks, setTasks] = useState<Task[]>(() => getCached<Task[]>("/api/tasks") ?? []);
  const [vendors, setVendors] = useState<Vendor[]>(() => getCached<Vendor[]>("/api/vendors") ?? []);
  const [categories, setCategories] = useState<string[]>(
    () => (getCached<CategoryColor[]>("/api/categories") ?? []).map((c) => c.name),
  );
  const [categoryColors, setCategoryColors] = useState<Record<string, string>>(
    () => (getCached<CategoryColor[]>("/api/categories") ?? []).reduce(
      (acc: Record<string, string>, c) => { acc[c.name] = c.color; return acc; },
      {},
    ),
  );
  const [completing, setCompleting] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [adding, setAdding] = useState(false);
  const addBackdropRef = useRef<HTMLDivElement>(null);
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    frequency: "Monthly" as Frequency,
    due_date: "",
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
        a.due_date.localeCompare(b.due_date),
      ),
    );
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
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAll();
  }, []);

  async function addTask() {
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...newTask,
        estimated_cost: newTask.estimated_cost || null,
        vendor_id: newTask.vendor_id || null,
      }),
    });
    setNewTask({
      title: "",
      description: "",
      frequency: "Monthly",
      due_date: "",
      estimated_cost: "",
      vendor_id: "",
      category: "",
    });
    setAdding(false);
    fetchAll();
  }

  async function completeTask(id: string) {
    setCompleting(id);
    await fetch(`/api/tasks/${id}/complete`, { method: "POST" });
    await fetchAll();
    setCompleting(null);
  }

  const active = tasks.filter((t) => t.status !== "Completed" && !t.archived);
  const done = tasks.filter((t) => t.status === "Completed" && !t.archived);

  return (
    <>
    <main className="animate-page max-w-6xl mx-auto px-4 py-10">
      <div className="flex items-start justify-between gap-8 mb-8">
        <div>
          <h1 className="text-2xl font-semibold mb-1 text-gray-900 dark:text-gray-100">
            Maintenance Tracker
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Active, completed and pending tasks
          </p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="shrink-0 text-sm px-3 py-1.5 rounded-md bg-gray-900 dark:bg-gray-700 text-white hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
        >
          Add task
        </button>
      </div>

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-3">
          Active ({active.length})
        </h2>
        <div className="space-y-3">
          {active.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              vendors={vendors}
              onComplete={completeTask}
              completing={completing}
              categoryColors={categoryColors}
            />
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
            <span className={`transition-transform duration-200 ${showCompleted ? "rotate-180" : ""}`}>▼</span>
          </button>
          <div
            className="grid transition-[grid-template-rows] duration-300 ease-out"
            style={{ gridTemplateRows: showCompleted ? "1fr" : "0fr" }}
          >
            <div className="overflow-hidden">
              <div className="space-y-3">
                {done.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    vendors={vendors}
                    onComplete={completeTask}
                    completing={completing}
                    categoryColors={categoryColors}
                  />
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
        onClick={(e) => { if (e.target === addBackdropRef.current) setAdding(false); }}
      >
        <div className="animate-modal bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto flex flex-col p-8">
          <h2 className="text-2xl font-bold mb-8 text-gray-900 dark:text-gray-100 shrink-0">New Task</h2>
          <div className="space-y-5 flex-1">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Title</label>
              <input value={newTask.title} onChange={(e) => setNewTask((f) => ({ ...f, title: e.target.value }))} className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-400" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Description</label>
              <textarea value={newTask.description} onChange={(e) => setNewTask((f) => ({ ...f, description: e.target.value }))} rows={3} className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-400" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Due date</label>
                <input type="date" value={newTask.due_date} onChange={(e) => setNewTask((f) => ({ ...f, due_date: e.target.value }))} className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-400" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Frequency</label>
                <select value={newTask.frequency} onChange={(e) => setNewTask((f) => ({ ...f, frequency: e.target.value as Frequency }))} className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-400">
                  {FREQUENCIES.map((f) => <option key={f}>{f}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Category</label>
                <select value={newTask.category} onChange={(e) => setNewTask((f) => ({ ...f, category: e.target.value }))} className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-400">
                  <option value="">Select category</option>
                  {categories.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Est. cost ($)</label>
                <input type="number" value={newTask.estimated_cost} onChange={(e) => setNewTask((f) => ({ ...f, estimated_cost: e.target.value }))} placeholder="—" className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-400" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Vendor</label>
              <select value={newTask.vendor_id} onChange={(e) => setNewTask((f) => ({ ...f, vendor_id: e.target.value }))} className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-400">
                <option value="">None</option>
                {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-3 mt-8 pt-6 border-t border-gray-100 dark:border-gray-800 shrink-0">
            <button
              onClick={addTask}
              disabled={!newTask.title || !newTask.due_date || !newTask.category}
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
