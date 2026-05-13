"use client";

import { useEffect, useState } from "react";

type Status = "Scheduled" | "In Progress" | "Completed" | "Overdue";
type Frequency = "Weekly" | "Bi-weekly" | "Monthly" | "Quarterly" | "Semi-Annually" | "Annually";

interface Task {
  id: string;
  title: string;
  description: string;
  frequency: Frequency;
  status: Status;
  due_date: string;
  last_completed_date: string | null;
  estimated_cost: number | null;
  vendor_id: string | null;
  category: string;
  archived?: boolean;
}

interface Vendor {
  id: string;
  name: string;
  service_type: string;
}

const FREQUENCIES: Frequency[] = ["Weekly", "Bi-weekly", "Monthly", "Quarterly", "Semi-Annually", "Annually"];

const STATUS_STYLES: Record<Status, string> = {
  Overdue: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
  "In Progress": "bg-yellow-100 text-yellow-700 dark:bg-amber-950 dark:text-amber-400",
  Scheduled: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  Completed: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
};

function TaskCard({
  task,
  vendors,
  onComplete,
  completing,
  onUpdate,
}: {
  task: Task;
  vendors: Vendor[];
  onComplete: (id: string) => void;
  completing: string | null;
  onUpdate: () => void;
}) {
  const vendor = vendors.find((v) => v.id === task.vendor_id);
  const isCompleted = task.status === "Completed";

  const [day, month] = new Date(task.due_date + "T00:00:00").toLocaleDateString("en-AU", { day: "2-digit", month: "short" }).split(" ");

  return (
    <div className={`border rounded-lg p-4 transition-colors ${isCompleted ? "border-gray-100 dark:border-gray-800 opacity-60" : "border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900"}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col items-center justify-center w-12 shrink-0 text-center">
          <span className="text-2xl font-bold leading-none text-gray-900 dark:text-gray-100">{day}</span>
          <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">{month}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <a href={`/tasks/${task.id}`} className={`font-medium hover:underline ${isCompleted ? "line-through text-gray-400 dark:text-gray-500" : "text-gray-900 dark:text-gray-100"}`}>{task.title}</a>
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-medium">
              {task.category}
            </span>
            {isCompleted && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[task.status]}`}>
                {task.status}
              </span>
            )}
            {vendor && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-400">
                {vendor.name}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">{task.description}</p>
          <div className="flex gap-4 text-xs text-gray-400 dark:text-gray-500 flex-wrap">
            <span>{task.frequency}</span>
            {task.estimated_cost != null && <span>${task.estimated_cost}</span>}
            {isCompleted && task.last_completed_date && (
              <span>Completed {task.last_completed_date}</span>
            )}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          {!isCompleted && (
            <button
              onClick={() => onComplete(task.id)}
              disabled={completing === task.id}
              className="text-sm px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 transition-colors"
            >
              {completing === task.id ? "Saving…" : "Mark done"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newTask, setNewTask] = useState({ title: "", description: "", frequency: "Monthly" as Frequency, due_date: "", estimated_cost: "", vendor_id: "", category: "" });

  async function fetchAll() {
    const [tasksRes, vendorsRes, categoriesRes] = await Promise.all([
      fetch("/api/tasks"),
      fetch("/api/vendors"),
      fetch("/api/categories"),
    ]);
    const [tasksData, vendorsData, categoriesData] = await Promise.all([tasksRes.json(), vendorsRes.json(), categoriesRes.json()]);
    setTasks(tasksData.sort((a: Task, b: Task) => a.due_date.localeCompare(b.due_date)));
    setVendors(vendorsData);
    setCategories(categoriesData);
    setLoading(false);
  }

  useEffect(() => { fetchAll(); }, []);

  async function addTask() {
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...newTask, estimated_cost: newTask.estimated_cost || null, vendor_id: newTask.vendor_id || null }),
    });
    setNewTask({ title: "", description: "", frequency: "Monthly", due_date: "", estimated_cost: "", vendor_id: "", category: "" });
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
    <main className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold mb-1 text-gray-900 dark:text-gray-100">OC Maintenance Tracker</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">4 units · Victoria, Australia</p>
        </div>
        <button onClick={() => setAdding((a) => !a)} className="text-sm px-3 py-1.5 rounded-md bg-gray-900 dark:bg-gray-700 text-white hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors">
          Add task
        </button>
      </div>

      {adding && (
        <div className="border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-6 space-y-3">
          <h2 className="font-medium text-sm text-gray-900 dark:text-gray-100">New task</h2>
          <div className="grid grid-cols-2 gap-3">
            <input value={newTask.title} onChange={(e) => setNewTask((f) => ({ ...f, title: e.target.value }))} placeholder="Title" className="col-span-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 dark:text-gray-100 dark:placeholder-gray-500" />
            <input value={newTask.description} onChange={(e) => setNewTask((f) => ({ ...f, description: e.target.value }))} placeholder="Description" className="col-span-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 dark:text-gray-100 dark:placeholder-gray-500" />
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-400 dark:text-gray-500">Due date</label>
              <input type="date" value={newTask.due_date} onChange={(e) => setNewTask((f) => ({ ...f, due_date: e.target.value }))} className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 dark:text-gray-100" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-400 dark:text-gray-500">Frequency</label>
              <select value={newTask.frequency} onChange={(e) => setNewTask((f) => ({ ...f, frequency: e.target.value as Frequency }))} className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 dark:text-gray-100">
                {FREQUENCIES.map((f) => <option key={f}>{f}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-400 dark:text-gray-500">Est. cost ($)</label>
              <input type="number" value={newTask.estimated_cost} onChange={(e) => setNewTask((f) => ({ ...f, estimated_cost: e.target.value }))} placeholder="—" className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 dark:text-gray-100 dark:placeholder-gray-500" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-400 dark:text-gray-500">Category</label>
              <select value={newTask.category} onChange={(e) => setNewTask((f) => ({ ...f, category: e.target.value }))} className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 dark:text-gray-100">
                <option value="">Select category</option>
                {categories.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-400 dark:text-gray-500">Vendor</label>
              <select value={newTask.vendor_id} onChange={(e) => setNewTask((f) => ({ ...f, vendor_id: e.target.value }))} className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 dark:text-gray-100">
                <option value="">None</option>
                {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={addTask} disabled={!newTask.title || !newTask.due_date || !newTask.category} className="text-sm px-3 py-1.5 rounded-md bg-gray-900 dark:bg-gray-700 text-white hover:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-40 transition-colors">Save</button>
            <button onClick={() => setAdding(false)} className="text-sm px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-gray-400">Loading...</p>
      ) : (
        <>
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
                  onUpdate={fetchAll}
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
                <span>{showCompleted ? "▲" : "▼"}</span>
              </button>
              {showCompleted && (
                <div className="space-y-3">
                  {done.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      vendors={vendors}
                      onComplete={completeTask}
                      completing={completing}
                      onUpdate={fetchAll}
                    />
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      )}
    </main>
  );
}
