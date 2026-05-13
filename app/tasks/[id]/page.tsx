"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";

interface Task {
  id: string;
  title: string;
  description: string;
  frequency: string;
  status: "Scheduled" | "In Progress" | "Completed" | "Overdue";
  due_date: string;
  last_completed_date: string | null;
  estimated_cost: number | null;
  vendor_id: string | null;
  archived?: boolean;
}

interface Vendor {
  id: string;
  name: string;
  service_type: string;
}

type Frequency = "Weekly" | "Bi-weekly" | "Monthly" | "Quarterly" | "Semi-Annually" | "Annually";
const FREQUENCIES: Frequency[] = ["Weekly", "Bi-weekly", "Monthly", "Quarterly", "Semi-Annually", "Annually"];

const STATUS_STYLES: Record<string, string> = {
  Overdue: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
  "In Progress": "bg-yellow-100 text-yellow-700 dark:bg-amber-950 dark:text-amber-400",
  Scheduled: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  Completed: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
};

function fmt(n: number): string {
  return n.toLocaleString("en-AU", { style: "currency", currency: "AUD" });
}

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const taskId = params.id as string;

  const [tasks, setTasks] = useState<Task[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [form, setForm] = useState<Partial<Task>>({});
  const [originalForm, setOriginalForm] = useState<Partial<Task>>({});
  const menuRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([fetch("/api/tasks"), fetch("/api/vendors"), fetch("/api/categories")])
      .then((res) => Promise.all(res.map((r) => r.json())))
      .then(([tasksData, vendorsData, categoriesData]) => {
        setTasks(tasksData);
        setVendors(vendorsData);
        setCategories(categoriesData);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  if (loading) return <main className="max-w-3xl mx-auto px-4 py-10"><p className="text-gray-400">Loading…</p></main>;

  const currentTask = tasks.find((t) => t.id === taskId);
  if (!currentTask) return <main className="max-w-3xl mx-auto px-4 py-10"><p className="text-gray-400">Task not found</p></main>;

  const series = tasks.filter((t) => t.title === currentTask.title).sort((a, b) => a.due_date.localeCompare(b.due_date));
  const vendor = vendors.find((v) => v.id === currentTask.vendor_id);
  const completed = series.filter((t) => t.status === "Completed");
  const upcoming = series.filter((t) => t.status !== "Completed").sort((a, b) => a.due_date.localeCompare(b.due_date));

  const totalCost = series.reduce((s, t) => s + (t.estimated_cost ?? 0), 0);
  const avgCost = completed.length > 0 ? completed.reduce((s, t) => s + (t.estimated_cost ?? 0), 0) / completed.length : 0;

  const canDelete = completed.length === 0;

  const openEdit = () => {
    const initial = {
      title: currentTask.title,
      description: currentTask.description,
      frequency: currentTask.frequency as Frequency,
      due_date: currentTask.due_date,
      estimated_cost: currentTask.estimated_cost,
      vendor_id: currentTask.vendor_id,
      category: currentTask.category,
    };
    setForm(initial);
    setOriginalForm(initial);
    setEditOpen(true);
  };

  const hasChanges = () => {
    return JSON.stringify(form) !== JSON.stringify(originalForm);
  };

  const closeEdit = () => {
    if (hasChanges() && !confirm("Discard unsaved changes?")) return;
    setEditOpen(false);
  };

  const saveEdit = async () => {
    await fetch(`/api/tasks/${taskId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setEditOpen(false);
    const res = await fetch("/api/tasks");
    setTasks(await res.json());
  };

  const handleArchive = async () => {
    if (!confirm(`Archive "${currentTask.title}"? It will be hidden from the main list but remain in the system.`)) return;
    await fetch(`/api/tasks/${taskId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: true }),
    });
    router.push("/");
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${currentTask.title}"? This cannot be undone.`)) return;
    await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
    router.push("/");
  };

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <a href="/" className="text-sm text-gray-400 hover:text-gray-600 mb-8 inline-block">← Back</a>

      <div className="mb-12">
        <div className="flex items-start justify-between gap-6 mb-8">
          <div className="flex-1">
            <h1 className="text-4xl font-bold mb-3 text-gray-900 dark:text-gray-100">{currentTask.title}</h1>
            <p className="text-base text-gray-600 dark:text-gray-400 leading-relaxed">{currentTask.description}</p>
          </div>
          <div ref={menuRef} className="relative shrink-0 mt-1">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="flex items-center justify-center w-8 h-8 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors text-base font-bold"
            >
              ⋮
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-1 w-40 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-lg z-10">
                <button onClick={() => { openEdit(); setMenuOpen(false); }} className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-100 dark:border-gray-800">
                  Edit
                </button>
                {completed.length > 0 && (
                  <button onClick={() => { handleArchive(); setMenuOpen(false); }} className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-100 dark:border-gray-800">
                    Archive
                  </button>
                )}
                {canDelete && (
                  <button onClick={() => { handleDelete(); setMenuOpen(false); }} className="block w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950">
                    Delete
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Stats and Details Grid */}
        <div className="grid grid-cols-2 gap-12 mb-12">
          {/* Left: Insights */}
          <div className="space-y-8">
            <div className="grid grid-cols-2 gap-8">
              <div>
                <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Total Completed</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{completed.length}</div>
              </div>
              <div>
                <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Avg Cost</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{fmt(avgCost)}</div>
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Total Cost</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{fmt(totalCost)}</div>
            </div>
          </div>

          {/* Right: Task Details */}
          <div className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-gray-500 dark:text-gray-400">Category</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">{currentTask.category}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-500 dark:text-gray-400">Due Date</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">{currentTask.due_date}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-500 dark:text-gray-400">Est. Cost</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">{currentTask.estimated_cost ? fmt(currentTask.estimated_cost) : "—"}</span>
            </div>
            {vendor && (
              <div className="flex justify-between gap-4 pt-3 border-t border-gray-100 dark:border-gray-800">
                <span className="text-gray-500 dark:text-gray-400">Vendor</span>
                <a href={`/vendors/${vendor.id}`} className="text-blue-600 dark:text-blue-400 hover:underline font-medium">{vendor.name}</a>
              </div>
            )}
          </div>
        </div>

      </div>

      {editOpen && (
        <div ref={backdropRef} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={(e) => { if (e.target === backdropRef.current) closeEdit(); }}>
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto flex flex-col p-8">
            <h2 className="text-2xl font-bold mb-8 text-gray-900 dark:text-gray-100 shrink-0">Edit Task</h2>
            <div className="space-y-5 flex-1 overflow-y-auto">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Title</label>
                <input value={form.title ?? ""} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-400" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Description</label>
                <textarea value={form.description ?? ""} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={3} className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-400" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Due Date</label>
                  <input type="date" value={form.due_date ?? ""} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-400" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Frequency</label>
                  <select value={form.frequency ?? ""} onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value as Frequency }))} className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-400">
                    {FREQUENCIES.map((f) => <option key={f}>{f}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Category</label>
                  <select value={form.category ?? ""} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-400">
                    {categories.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Est. Cost</label>
                  <input type="number" value={form.estimated_cost ?? ""} onChange={(e) => setForm((f) => ({ ...f, estimated_cost: e.target.value ? Number(e.target.value) : null }))} className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-400" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Vendor</label>
                <select value={form.vendor_id ?? ""} onChange={(e) => setForm((f) => ({ ...f, vendor_id: e.target.value || null }))} className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-400">
                  <option value="">None</option>
                  {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-8 pt-6 border-t border-gray-100 dark:border-gray-800 shrink-0">
              <button onClick={saveEdit} className="flex-1 text-sm px-4 py-2 rounded-md bg-gray-900 dark:bg-gray-700 text-white hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors font-medium">Save</button>
              <button onClick={closeEdit} className="flex-1 text-sm px-4 py-2 rounded-md border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-medium">Cancel</button>
            </div>
          </div>
        </div>
      )}

      <section>
        {upcoming.length > 0 && (
          <div className="mb-12">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-gray-400 mb-6">Upcoming</h3>
            <div className="space-y-4">
              {upcoming.map((task) => (
                <div key={task.id} className="flex items-start gap-6 py-4 border-b border-gray-100 dark:border-gray-800 last:border-0">
                  <div className="w-20 shrink-0 text-center">
                    <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{new Date(task.due_date + "T00:00:00").toLocaleDateString("en-AU", { day: "2-digit" })}</div>
                    <div className="text-xs text-gray-400 dark:text-gray-500 font-semibold uppercase mt-1">{new Date(task.due_date + "T00:00:00").toLocaleDateString("en-AU", { month: "short" })}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`text-xs px-2 py-1 rounded font-medium ${STATUS_STYLES[task.status]}`}>{task.status}</span>
                      {task.estimated_cost && <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{fmt(task.estimated_cost)}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {completed.length > 0 && (
          <div className="mb-8">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-6">Completion History</h3>
            <div className="space-y-4">
              {completed.map((task) => (
                <div key={task.id} className="flex items-start gap-6 py-4 border-b border-gray-100 dark:border-gray-800 last:border-0">
                  <div className="w-20 shrink-0">
                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{task.last_completed_date}</div>
                    <div className="text-xs text-gray-400 dark:text-gray-500 font-semibold uppercase mt-1">Completed</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      {task.estimated_cost && <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{fmt(task.estimated_cost)}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
