"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";

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

interface Task {
  id: string;
  title: string;
  frequency: string;
  status: "Scheduled" | "In Progress" | "Completed" | "Overdue";
  due_date: string;
  last_completed_date: string | null;
  estimated_cost: number | null;
  vendor_id: string | null;
}

const STATUS_STYLES: Record<string, string> = {
  Overdue: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
  "In Progress": "bg-yellow-100 text-yellow-700 dark:bg-amber-950 dark:text-amber-400",
  Scheduled: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  Completed: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
};

const INPUT = "w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-600";

function fmt(n: number): string {
  return n.toLocaleString("en-AU", { style: "currency", currency: "AUD" });
}

export default function VendorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const vendorId = params.id as string;

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [form, setForm] = useState<Partial<Vendor>>({});
  const [originalForm, setOriginalForm] = useState<Partial<Vendor>>({});
  const menuRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([fetch("/api/vendors"), fetch("/api/tasks")])
      .then((res) => Promise.all(res.map((r) => r.json())))
      .then(([vendorsData, tasksData]) => {
        setVendors(vendorsData);
        setTasks(tasksData);
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

  if (loading) return <main className="max-w-4xl mx-auto px-4 py-8"><p className="text-gray-400">Loading…</p></main>;

  const vendor = vendors.find((v) => v.id === vendorId);
  if (!vendor) return <main className="max-w-4xl mx-auto px-4 py-8"><p className="text-gray-400">Vendor not found</p></main>;

  const assignedTasks = tasks.filter((t) => t.vendor_id === vendorId).sort((a, b) => a.due_date.localeCompare(b.due_date));
  const completed = assignedTasks.filter((t) => t.status === "Completed");
  const upcoming = assignedTasks.filter((t) => t.status !== "Completed");
  const totalCost = assignedTasks.reduce((s, t) => s + (t.estimated_cost ?? 0), 0);
  const canDelete = completed.length === 0;

  const openEdit = () => {
    const initial = {
      name: vendor.name,
      service_type: vendor.service_type,
      email: vendor.email ?? "",
      phone: vendor.phone ?? "",
      address: vendor.address ?? "",
      hourly_rate: vendor.hourly_rate ?? undefined,
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
    setVendors(await res.json());
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
    <main className="max-w-4xl mx-auto px-4 py-8">
      <a href="/vendors" className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 mb-8 inline-block">
        ← Back
      </a>

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
            <div>
              <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Total Cost</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{fmt(totalCost)}</div>
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
            {vendor.hourly_rate && (
              <div className="flex justify-between gap-4">
                <span className="text-gray-500 dark:text-gray-400">Rate</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">{fmt(vendor.hourly_rate)}/hr</span>
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
            <div className="space-y-4">
              {upcoming.map((task) => (
                <div key={task.id} className="flex items-start gap-6 py-4 border-b border-gray-100 dark:border-gray-800 last:border-0">
                  <div className="w-20 shrink-0 text-center">
                    <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {new Date(task.due_date + "T00:00:00").toLocaleDateString("en-AU", { day: "2-digit" })}
                    </div>
                    <div className="text-xs text-gray-400 dark:text-gray-500 font-semibold uppercase mt-1">
                      {new Date(task.due_date + "T00:00:00").toLocaleDateString("en-AU", { month: "short" })}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <a href={`/tasks/${task.id}`} className="font-medium text-gray-900 dark:text-gray-100 hover:underline block mb-2">
                      {task.title}
                    </a>
                    <div className="flex items-center gap-3">
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
            <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-6">Completed Work</h2>
            <div className="space-y-4">
              {completed.map((task) => (
                <div key={task.id} className="flex items-start gap-6 py-4 border-b border-gray-100 dark:border-gray-800 last:border-0">
                  <div className="w-20 shrink-0">
                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{task.last_completed_date}</div>
                    <div className="text-xs text-gray-400 dark:text-gray-500 font-semibold uppercase mt-1">Done</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <a href={`/tasks/${task.id}`} className="font-medium text-gray-900 dark:text-gray-100 hover:underline block mb-2">
                      {task.title}
                    </a>
                    <div className="flex items-center gap-3">
                      <span className="text-xs px-2 py-1 rounded font-medium bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400">Completed</span>
                      {task.estimated_cost && <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{fmt(task.estimated_cost)}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {assignedTasks.length === 0 && (
          <p className="text-sm text-gray-400 dark:text-gray-500">No tasks assigned to this vendor.</p>
        )}
      </section>

      {/* Edit Modal */}
      {editOpen && (
        <div
          ref={backdropRef}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === backdropRef.current) closeEdit(); }}
        >
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto flex flex-col p-8">
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Address</label>
                  <input value={form.address ?? ""} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} className={INPUT} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Hourly rate</label>
                  <input type="number" value={form.hourly_rate ?? ""} onChange={(e) => setForm((f) => ({ ...f, hourly_rate: e.target.value ? Number(e.target.value) : null }))} className={INPUT} />
                </div>
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
    </main>
  );
}
