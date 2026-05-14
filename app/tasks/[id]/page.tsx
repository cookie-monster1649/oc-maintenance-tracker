"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { TaskCard, Task, Vendor } from "../../components/TaskCard";
import { getColorClasses } from "@/lib/colors";
import { getCached, setCached } from "@/lib/cache";

type Frequency = "Weekly" | "Bi-weekly" | "Monthly" | "Quarterly" | "Semi-Annually" | "Annually";
const FREQUENCIES: Frequency[] = ["Weekly", "Bi-weekly", "Monthly", "Quarterly", "Semi-Annually", "Annually"];

interface CategoryColor {
  name: string;
  color: string;
}

function fmt(n: number): string {
  return n.toLocaleString("en-AU", { style: "currency", currency: "AUD" });
}

function fiscalYearLabel(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const fyStart = month >= 7 ? year : year - 1;
  return `FY ${String(fyStart).slice(2)}/${String(fyStart + 1).slice(2)}`;
}

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const taskId = params.id as string;

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
  const [editOpen, setEditOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [completing, setCompleting] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Task>>({});
  const [originalForm, setOriginalForm] = useState<Partial<Task>>({});
  const menuRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  async function fetchTasks() {
    const res = await fetch("/api/tasks");
    const data = await res.json();
    setCached("/api/tasks", data);
    setTasks(data);
  }

  async function fetchAll() {
    const [tasksRes, vendorsRes, categoriesRes] = await Promise.all([
      fetch("/api/tasks"), fetch("/api/vendors"), fetch("/api/categories"),
    ]);
    const [tasksData, vendorsData, categoriesData] = await Promise.all([
      tasksRes.json(), vendorsRes.json(), categoriesRes.json(),
    ]) as [Task[], Vendor[], CategoryColor[]];
    setCached("/api/tasks", tasksData);
    setCached("/api/vendors", vendorsData);
    setCached("/api/categories", categoriesData);
    setTasks(tasksData);
    setVendors(vendorsData);
    setCategories(categoriesData.map((c) => c.name));
    setCategoryColors(categoriesData.reduce((acc: Record<string, string>, c: CategoryColor) => {
      acc[c.name] = c.color;
      return acc;
    }, {}));
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAll();
  }, []);

  async function completeTask(id: string) {
    setCompleting(id);
    await fetch(`/api/tasks/${id}/complete`, { method: "POST" });
    await fetchTasks();
    setCompleting(null);
  }

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const currentTask = tasks.find((t) => t.id === taskId);
  if (!currentTask) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-10">
        <p className="text-gray-400">{tasks.length === 0 ? "Loading…" : "Task not found"}</p>
      </main>
    );
  }

  const series = tasks.filter((t) => t.title === currentTask.title).sort((a, b) => a.due_date.localeCompare(b.due_date));
  const vendor = vendors.find((v) => v.id === currentTask.vendor_id);
  const completed = series.filter((t) => t.status === "Completed");
  const upcoming = series.filter((t) => t.status !== "Completed").sort((a, b) => a.due_date.localeCompare(b.due_date));

  const totalCost = completed.reduce((s, t) => s + (t.estimated_cost ?? 0), 0);
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
    const data = await res.json();
    setCached("/api/tasks", data);
    setTasks(data);
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
    <>
    <main className="animate-page max-w-4xl mx-auto px-4 py-8">
      <Link href="/" className="text-sm text-gray-400 hover:text-gray-600 mb-8 inline-block">← Back</Link>

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
                <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Task Cost</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{fmt(avgCost)}</div>
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Actuals {fiscalYearLabel()}</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{fmt(totalCost)}</div>
            </div>
          </div>

          {/* Right: Task Details */}
          <div className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-gray-500 dark:text-gray-400">Category</span>
              {(() => {
                const colors = getColorClasses(categoryColors[currentTask.category] || "blue");
                return (
                  <span className={`px-2 py-0.5 rounded-full ${colors.bg} ${colors.text} font-medium text-xs`}>
                    {currentTask.category}
                  </span>
                );
              })()}
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

      <section>
        {upcoming.length > 0 && (
          <div className="mb-12">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-gray-400 mb-6">Upcoming</h3>
            <div className="space-y-3">
              {upcoming.map((task) => (
                <TaskCard key={task.id} task={task} vendors={vendors} onComplete={completeTask} completing={completing} categoryColors={categoryColors} />
              ))}
            </div>
          </div>
        )}

        {completed.length > 0 && (
          <div className="mb-8">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-6">Completion History</h3>
            <div className="space-y-3">
              {completed.map((task) => (
                <TaskCard key={task.id} task={task} vendors={vendors} onComplete={completeTask} completing={completing} categoryColors={categoryColors} />
              ))}
            </div>
          </div>
        )}
      </section>
    </main>

    {editOpen && (
      <div ref={backdropRef} className="animate-backdrop fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={(e) => { if (e.target === backdropRef.current) closeEdit(); }}>
        <div className="animate-modal bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto flex flex-col p-8">
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
    </>
  );
}
