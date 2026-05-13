"use client";

import { useEffect, useRef, useState } from "react";

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

const EMPTY: Omit<Vendor, "id"> = {
  name: "",
  service_type: "",
  email: "",
  phone: "",
  address: "",
  hourly_rate: null,
  notes: "",
};

const INPUT = "w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-600";

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [originalForm, setOriginalForm] = useState(EMPTY);
  const backdropRef = useRef<HTMLDivElement>(null);

  async function fetchVendors() {
    const res = await fetch("/api/vendors");
    setVendors(await res.json());
  }

  useEffect(() => { fetchVendors().then(() => setLoading(false)); }, []);

  function openAdd() {
    setForm(EMPTY);
    setOriginalForm(EMPTY);
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(v: Vendor) {
    const initial = { name: v.name, service_type: v.service_type, email: v.email ?? "", phone: v.phone ?? "", address: v.address ?? "", hourly_rate: v.hourly_rate, notes: v.notes ?? "", archived: v.archived };
    setForm(initial);
    setOriginalForm(initial);
    setEditing(v);
    setModalOpen(true);
  }

  function closeModal() {
    const hasChanges = JSON.stringify(form) !== JSON.stringify(originalForm);
    if (hasChanges && !confirm("Discard unsaved changes?")) return;
    setModalOpen(false);
    setEditing(null);
  }

  async function save() {
    const body = { ...form, hourly_rate: form.hourly_rate ? Number(form.hourly_rate) : null };
    if (editing) {
      await fetch(`/api/vendors/${editing.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    } else {
      await fetch("/api/vendors", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    }
    setModalOpen(false);
    setEditing(null);
    fetchVendors();
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    await fetch(`/api/vendors/${id}`, { method: "DELETE" });
    fetchVendors();
  }

  const active = vendors.filter((v) => !v.archived);

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-start justify-between mb-10">
        <div>
          <h1 className="text-4xl font-bold mb-2 text-gray-900 dark:text-gray-100">Vendors</h1>
          <p className="text-base text-gray-600 dark:text-gray-400">Service providers for the building</p>
        </div>
        <button
          onClick={openAdd}
          className="text-sm px-3 py-1.5 rounded-md bg-gray-900 dark:bg-gray-700 text-white hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
        >
          Add vendor
        </button>
      </div>

      {loading ? (
        <p className="text-gray-400">Loading…</p>
      ) : active.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500">No vendors yet.</p>
      ) : (
        <div className="space-y-0">
          {active.map((v, i) => (
            <div
              key={v.id}
              className={`flex items-start justify-between gap-4 py-5 ${i < active.length - 1 ? "border-b border-gray-100 dark:border-gray-800" : ""}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1.5">
                  <a href={`/vendors/${v.id}`} className="font-medium text-gray-900 dark:text-gray-100 hover:underline">
                    {v.name}
                  </a>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                    {v.service_type}
                  </span>
                </div>
                <div className="flex flex-wrap gap-4 text-xs text-gray-400 dark:text-gray-500">
                  {v.phone && <span>{v.phone}</span>}
                  {v.email && <span>{v.email}</span>}
                  {v.hourly_rate && <span>${v.hourly_rate}/hr</span>}
                  {v.address && <span>{v.address}</span>}
                </div>
                {v.notes && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{v.notes}</p>}
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => openEdit(v)}
                  className="text-sm px-3 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => remove(v.id, v.name)}
                  className="text-sm px-3 py-1.5 rounded-md border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div
          ref={backdropRef}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === backdropRef.current) closeModal(); }}
        >
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto flex flex-col p-8">
            <h2 className="text-2xl font-bold mb-8 text-gray-900 dark:text-gray-100 shrink-0">
              {editing ? "Edit Vendor" : "New Vendor"}
            </h2>
            <div className="space-y-5 flex-1">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Name</label>
                <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={INPUT} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Service type</label>
                <input value={form.service_type} onChange={(e) => setForm((f) => ({ ...f, service_type: e.target.value }))} className={INPUT} />
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
                onClick={save}
                disabled={!form.name}
                className="flex-1 text-sm px-4 py-2 rounded-md bg-gray-900 dark:bg-gray-700 text-white hover:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-40 transition-colors font-medium"
              >
                Save
              </button>
              <button
                onClick={closeModal}
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
