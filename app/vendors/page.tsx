"use client";

import { useEffect, useState } from "react";
import { getCached, setCached } from "@/lib/cache";
import { useGodMode } from "@/app/contexts/god-mode";
import { getColorClasses } from "@/lib/colors";
import VendorModal from "@/app/components/VendorModal";

interface Vendor {
  id: string;
  name: string;
  service_type: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  archived?: boolean;
  paperless_correspondent_id?: number | null;
}

interface Task {
  id: string;
  vendor_id: string | null;
  line_item_id: string | null;
  estimated_cost: number | null;
}

interface LineItem {
  id: string;
  category: string;
  vendor_id: string | null;
}

interface CategoryColor {
  name: string;
  color: string;
}

interface PaperlessCorrespondent {
  id: number;
  name: string;
}

const EMPTY = {
  name: "",
  service_type: "",
  email: null as string | null,
  phone: null as string | null,
  address: null as string | null,
  notes: null as string | null,
  paperless_correspondent_id: null as number | null,
};

export default function VendorsPage() {
  const { godMode } = useGodMode();
  const [vendors, setVendors] = useState<Vendor[]>(
    () => getCached<Vendor[]>("/api/vendors") ?? [],
  );
  const [tasks, setTasks] = useState<Task[]>(
    () => getCached<Task[]>("/api/tasks") ?? [],
  );
  const [lineItems, setLineItems] = useState<LineItem[]>(
    () => getCached<LineItem[]>("/api/line-items") ?? [],
  );
  const [categoryColors, setCategoryColors] = useState<Record<string, string>>(
    () =>
      (getCached<CategoryColor[]>("/api/categories") ?? []).reduce(
        (acc: Record<string, string>, c) => { acc[c.name] = c.color; return acc; },
        {},
      ),
  );
  const [correspondents, setCorrespondents] = useState<
    PaperlessCorrespondent[]
  >([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [originalForm, setOriginalForm] = useState(EMPTY);

  async function fetchVendors() {
    const [vendorsRes, tasksRes, lineItemsRes, categoriesRes, corrRes] = await Promise.all([
      fetch("/api/vendors"),
      fetch("/api/tasks"),
      fetch("/api/line-items"),
      fetch("/api/categories"),
      fetch("/api/paperless/correspondents").catch(() => null),
    ]);
    const [vendorsData, tasksData, lineItemsData, categoriesData, corrData] = await Promise.all([
      vendorsRes.json(),
      tasksRes.json(),
      lineItemsRes.json(),
      categoriesRes.json(),
      corrRes ? corrRes.json() : Promise.resolve([]),
    ]);
    setCached("/api/vendors", vendorsData);
    setCached("/api/tasks", tasksData);
    setCached("/api/line-items", lineItemsData);
    setCached("/api/categories", categoriesData);
    setVendors(vendorsData);
    setTasks(tasksData);
    setLineItems(lineItemsData);
    setCategoryColors(
      (categoriesData as CategoryColor[]).reduce((acc: Record<string, string>, c) => {
        acc[c.name] = c.color;
        return acc;
      }, {}),
    );
    setCorrespondents(Array.isArray(corrData) ? corrData : []);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchVendors();
  }, []);

  function categoriesForVendor(vendorId: string): string[] {
    const lineItemVendorMap = new Map(lineItems.map((li) => [li.id, li.vendor_id]));
    const lineItemCategoryMap = new Map(lineItems.map((li) => [li.id, li.category]));
    const cats = new Set<string>();
    tasks.forEach((t) => {
      const effectiveVendorId = t.vendor_id ?? (t.line_item_id ? lineItemVendorMap.get(t.line_item_id) : null);
      if (effectiveVendorId !== vendorId) return;
      const cat = t.line_item_id ? lineItemCategoryMap.get(t.line_item_id) : null;
      if (cat) cats.add(cat);
    });
    return Array.from(cats);
  }

  function avgCostForVendor(vendorId: string): number | null {
    const vendorTasks = tasks.filter(
      (t) => t.vendor_id === vendorId && t.estimated_cost != null,
    );
    if (vendorTasks.length === 0) return null;
    return (
      vendorTasks.reduce((s, t) => s + t.estimated_cost!, 0) /
      vendorTasks.length
    );
  }

  function openAdd() {
    setForm(EMPTY);
    setOriginalForm(EMPTY);
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(v: Vendor) {
    const initial = {
      name: v.name,
      service_type: v.service_type,
      email: v.email,
      phone: v.phone,
      address: v.address,
      notes: v.notes,
      paperless_correspondent_id: v.paperless_correspondent_id ?? null,
    };
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
    const body = { ...form };
    if (editing) {
      await fetch(`/api/vendors/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } else {
      await fetch("/api/vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }
    setModalOpen(false);
    setEditing(null);
    fetchVendors();
  }

  const active = vendors.filter((v) => !v.archived);

  return (
    <>
      <main className="animate-page content-container py-10">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-semibold mb-1 text-gray-900 dark:text-gray-100">
              Vendors
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Service providers for the building
            </p>
          </div>
          {godMode && (
            <button
              onClick={openAdd}
              className="text-sm px-3 py-1.5 rounded-md bg-gray-900 dark:bg-gray-700 text-white hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
            >
              Add vendor
            </button>
          )}
        </div>

        {active.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">
            No vendors yet.
          </p>
        ) : (
          <div className="space-y-0">
            {active.map((v, i) => (
              <div
                key={v.id}
                className={`flex items-start justify-between gap-4 py-5 ${i < active.length - 1 ? "border-b border-gray-100 dark:border-gray-800" : ""}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-3 mb-0.5">
                    <a
                      href={`/vendors/${v.id}`}
                      className="font-medium text-gray-900 dark:text-gray-100 hover:underline break-words"
                    >
                      {v.name}
                    </a>
                    {(() => {
                      const cats = categoriesForVendor(v.id);
                      return cats.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {cats.map((cat) => {
                            const colors = getColorClasses(categoryColors[cat] || "blue");
                            return (
                              <span key={cat} className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${colors.bg} ${colors.text}`}>
                                {cat}
                              </span>
                            );
                          })}
                        </div>
                      ) : null;
                    })()}
                  </div>
                  {v.service_type && (
                    <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 mb-1">
                      {v.service_type}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-4 text-xs text-gray-400 dark:text-gray-500">
                    {v.phone && <span>{v.phone}</span>}
                    {v.email && <span>{v.email}</span>}
                    {(() => {
                      const avg = avgCostForVendor(v.id);
                      return avg != null ? (
                        <span>Avg. ${Math.round(avg)}/task</span>
                      ) : null;
                    })()}
                    {v.address && <span>{v.address}</span>}
                  </div>
                  {v.notes && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      {v.notes}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  {godMode && (
                    <button
                      onClick={() => openEdit(v)}
                      className="text-sm px-3 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      Edit
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <VendorModal
        isOpen={modalOpen}
        editing={editing}
        form={form}
        setForm={setForm}
        correspondents={correspondents}
        onClose={closeModal}
        onSave={save}
      />
    </>
  );
}
