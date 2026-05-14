"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { TaskCard, Task } from "../../components/TaskCard";
import { getCached, setCached } from "@/lib/cache";

interface CategoryColor {
  name: string;
  color: string;
}

interface Vendor {
  id: string;
  name: string;
  service_type: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  hourly_rate: number | null;
  notes: string | null;
  archived?: boolean;
}

const INPUT = "w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-600";

function fmt(n: number): string {
  return n.toLocaleString("en-AU", { style: "currency", currency: "AUD" });
}

export default function VendorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const vendorId = params.id as string;

  const [vendors, setVendors] = useState<Vendor[]>(() => getCached<Vendor[]>("/api/vendors") ?? []);
  const [tasks, setTasks] = useState<Task[]>(() => getCached<Task[]>("/api/tasks") ?? []);
  const [categoryColors, setCategoryColors] = useState<Record<string, string>>(
    () => (getCached<CategoryColor[]>("/api/categories") ?? []).reduce(
      (acc: Record<string, string>, c) => { acc[c.name] = c.color; return acc; },
      {},
    ),
  );
  const [editOpen, setEditOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [completing, setCompleting] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Vendor>>({});
  const [originalForm, setOriginalForm] = useState<Partial<Vendor>>({});
  const menuRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  async function fetchTasks() {
    const res = await fetch("/api/tasks");
    const data = await res.json();
    setCached("/api/tasks", data);
    setTasks(data);
  }

  async function fetchAll() {
    const [vendorsRes, tasksRes, categoriesRes] = await Promise.all([
      fetch("/api/vendors"), fetch("/api/tasks"), fetch("/api/categories"),
    ]);
    const [vendorsData, tasksData, categoriesData] = await Promise.all([
      vendorsRes.json(), tasksRes.json(), categoriesRes.json(),
    ]) as [Vendor[], Task[], CategoryColor[]];
    setCached("/api/vendors", vendorsData);
    setCached("/api/tasks", tasksData);
    setCached("/api/categories", categoriesData);
    setVendors(vendorsData);
    setTasks(tasksData);
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

  const vendor = vendors.find((v) => v.id === vendorId);
  if (!vendor) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-8">
        <p className="text-gray-400">{vendors.length === 0 ? "Loading…" : "Vendor not found"}</p>
      </main>
    );
  }

  const assignedTasks = tasks.filter((t) => t.vendor_id === vendorId).sort((a, b) => a.due_date.localeCompare(b.due_date));
  const completed = assignedTasks.filter((t) => t.status === "Completed");
  const upcoming = assignedTasks.filter((t) => t.status !== "Completed");
  const totalCost = assignedTasks.reduce((s, t) => s + (t.estimated_cost ?? 0), 0);
  const tasksWithCost = assignedTasks.filter((t) => t.estimated_cost != null);
  const avgCost = tasksWithCost.length > 0
    ? tasksWithCost.reduce((s, t) => s + (t.estimated_cost ?? 0), 0) / tasksWithCost.length
    : null;
  const canDelete = completed.length === 0;

  const openEdit = () => {
    const initial = {
      name: vendor.name,
      service_type: vendor.service_type,
      email: vendor.email ?? "",
      phone: vendor.phone ?? "",
      address: vendor.address ?? "",
      notes: vendor.notes ?? "",
    };
    setForm(initial);
    setOriginalForm(initial);
    setEditOpen(true);
    setMenuOpen(false);
  };

  const closeEdit = () => {
    if (JSON.stringify(form) !== JSON.stringify(originalForm) && !confirm("Discard unsaved changes?")) return;
    setEditOpen(false);
  };

  const saveEdit = async () => {
    await fetch(`/api/vendors/${vendorId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setEditOpen(false);
    const res = await fetch("/api/vendors");
    const data = await res.json();
    setCached("/api/vendors", data);
    setVendors(data);
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${vendor.name}"? This cannot be undone.`)) return;
    await fetch(`/api/vendors/${vendorId}`, { method: "DELETE" });
    router.push("/vendors");
  };

  const handleArchive = async () => {
    if (!confirm(`Archive "${vendor.name}"? It will be hidden from the main list but remain in the system.`)) return;
    await fetch(`/api/vendors/${vendorId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: true }),
    });
    router.push("/vendors");
  };

  return (
    <>
    <main className="animate-page max-w-4xl mx-auto px-4 py-8">
      <Link href="/vendors" className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 mb-8 inline-block">
        ← Back
      </Link>

      {/* Header */}
      <div className="mb-12">
        <div className="flex items-start justify-between gap-6 mb-8">
          <div className="flex-1">
            <h1 className="text-4xl font-bold mb-3 text-gray-900 dark:text-gray-100">{vendor.name}</h1>
            <p className="text-base text-gray-600 dark:text-gray-400 leading-relaxed">{vendor.service_type}</p>
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
                <button onClick={openEdit} className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-100 dark:border-gray-800">
                  Edit
                </button>
                {completed.length > 0 && (
                  <button onClick={handleArchive} className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-100 dark:border-gray-800">
                    Archive
                  </button>
                )}
                {canDelete && (
                  <button onClick={handleDelete} className="block w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950">
                    Delete
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Stats and Details Grid */}
        <div className="grid grid-cols-2 gap-12 mb-12">
          {/* Left: Stats */}
          <div className="space-y-8">
            <div className="grid grid-cols-2 gap-8">
              <div>
                <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Total Tasks</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{assignedTasks.length}</div>
              </div>
              <div>
                <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Completed</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{completed.length}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-8">
              <div>
                <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Total Cost</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{fmt(totalCost)}</div>
              </div>
              <div>
                <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Avg. Cost</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{avgCost != null ? fmt(avgCost) : "—"}</div>
              </div>
            </div>
          </div>

          {/* Right: Contact Details */}
          <div className="space-y-3 text-sm">
            {vendor.phone && (
              <div className="flex justify-between gap-4">
                <span className="text-gray-500 dark:text-gray-400">Phone</span>
                <a href={`tel:${vendor.phone}`} className="text-blue-600 dark:text-blue-400 hover:underline font-medium">{vendor.phone}</a>
              </div>
            )}
            {vendor.email && (
              <div className="flex justify-between gap-4">
                <span className="text-gray-500 dark:text-gray-400">Email</span>
                <a href={`mailto:${vendor.email}`} className="text-blue-600 dark:text-blue-400 hover:underline font-medium text-right">{vendor.email}</a>
              </div>
            )}
            {vendor.address && (
              <div className="flex justify-between gap-4">
                <span className="text-gray-500 dark:text-gray-400">Location</span>
                <span className="font-medium text-gray-900 dark:text-gray-100 text-right">{vendor.address}</span>
              </div>
            )}
            {vendor.notes && (
              <div className="flex justify-between gap-4 pt-3 border-t border-gray-100 dark:border-gray-800">
                <span className="text-gray-500 dark:text-gray-400">Notes</span>
                <span className="text-gray-600 dark:text-gray-400 text-right">{vendor.notes}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Work History */}
      <section>
        {upcoming.length > 0 && (
          <div className="mb-12">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-6">Upcoming Work</h2>
            <div className="space-y-3">
              {upcoming.map((task) => (
                <TaskCard key={task.id} task={task} vendors={vendors.map((v) => ({ id: v.id, name: v.name, service_type: v.service_type }))} onComplete={completeTask} completing={completing} categoryColors={categoryColors} />
              ))}
            </div>
          </div>
        )}

        {completed.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-6">Completed Work</h2>
            <div className="space-y-3">
              {completed.map((task) => (
                <TaskCard key={task.id} task={task} vendors={vendors.map((v) => ({ id: v.id, name: v.name, service_type: v.service_type }))} onComplete={completeTask} completing={completing} categoryColors={categoryColors} />
              ))}
            </div>
          </div>
        )}

        {assignedTasks.length === 0 && (
          <p className="text-sm text-gray-400 dark:text-gray-500">No tasks assigned to this vendor.</p>
        )}
      </section>

    </main>

    {editOpen && (
      <div
        ref={backdropRef}
        className="animate-backdrop fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
        onClick={(e) => { if (e.target === backdropRef.current) closeEdit(); }}
      >
        <div className="animate-modal bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto flex flex-col p-8">
          <h2 className="text-2xl font-bold mb-8 text-gray-900 dark:text-gray-100 shrink-0">Edit Vendor</h2>
          <div className="space-y-5 flex-1 overflow-y-auto">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Name</label>
              <input value={form.name ?? ""} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={INPUT} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Service type</label>
              <input value={form.service_type ?? ""} onChange={(e) => setForm((f) => ({ ...f, service_type: e.target.value }))} className={INPUT} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Phone</label>
                <input value={form.phone ?? ""} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className={INPUT} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Email</label>
                <input type="email" value={form.email ?? ""} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className={INPUT} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Address</label>
              <input value={form.address ?? ""} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} className={INPUT} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Notes</label>
              <textarea value={form.notes ?? ""} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={3} className={INPUT} />
            </div>
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
