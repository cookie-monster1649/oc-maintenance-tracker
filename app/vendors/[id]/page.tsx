"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { TaskCard, Task } from "../../components/TaskCard";
import { getCached, setCached } from "@/lib/cache";
import { badgeColour } from "@/lib/badge-colour";
import { format, parseISO } from "date-fns";
import { type PaperlessCorrespondent } from "@/lib/paperless";

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
  paperless_correspondent_id?: number | null;
}

interface SmartAction {
  type: "MATCH_COMPLETED" | "COMPLETE_SCHEDULED";
  taskId: string;
  taskTitle: string;
  dateLabel: string;
  confidence: number;
}

interface Document {
  id: number;
  title: string;
  tag_names: string[];
  document_type_label: string | null;
  created?: string;
  url: string;
  is_matched: boolean;
  correspondent: number | null;
  smart_actions: SmartAction[];
}

const INPUT =
  "w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-600";

function fmt(n: number): string {
  return n.toLocaleString("en-AU", { style: "currency", currency: "AUD" });
}

export default function VendorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const vendorId = params.id as string;

  const [vendors, setVendors] = useState<Vendor[]>(
    () => getCached<Vendor[]>("/api/vendors") ?? [],
  );
  const [tasks, setTasks] = useState<Task[]>(
    () => getCached<Task[]>("/api/tasks") ?? [],
  );
  const [vendorDocs, setVendorDocs] = useState<Document[]>([]);
  const [correspondents, setCorrespondents] = useState<
    PaperlessCorrespondent[]
  >([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
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
  const [categories, setCategories] = useState<string[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [completing, setCompleting] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Vendor>>({});
  const [originalForm, setOriginalForm] = useState<Partial<Vendor>>({});

  // Document matching state
  const [matchingDoc, setMatchingDoc] = useState<Document | null>(null);
  const [selectedTaskTitle, setSelectedTaskTitle] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [createAsOccurrence, setCreateAsOccurrence] = useState(false);
  const [occurrenceDate, setOccurrenceDate] = useState("");
  const [newTaskForm, setNewTaskForm] = useState({ title: "", category: "", start_date: "", frequency: "" });
  const [successInfo, setSuccessInfo] = useState<{ title: string; docUrl: string } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  async function fetchTasks() {
    const res = await fetch("/api/tasks");
    const data = await res.json();
    setCached("/api/tasks", data);
    setTasks(data);
  }

  const fetchAll = useCallback(async () => {
    const [vendorsRes, tasksRes, categoriesRes, corrRes] = await Promise.all([
      fetch("/api/vendors"),
      fetch("/api/tasks"),
      fetch("/api/categories"),
      fetch("/api/paperless/correspondents").catch(() => null),
    ]);
    const [vendorsData, tasksData, categoriesData, corrData] =
      (await Promise.all([
        vendorsRes.json(),
        tasksRes.json(),
        categoriesRes.json(),
        corrRes ? corrRes.json() : Promise.resolve([]),
      ])) as [Vendor[], Task[], CategoryColor[], PaperlessCorrespondent[]];
    setCached("/api/vendors", vendorsData);
    setCached("/api/tasks", tasksData);
    setCached("/api/categories", categoriesData);
    setVendors(vendorsData);
    setTasks(tasksData);
    setCorrespondents(Array.isArray(corrData) ? corrData : []);
    setCategories(categoriesData.map((c: CategoryColor) => c.name));
    setCategoryColors(
      categoriesData.reduce((acc: Record<string, string>, c: CategoryColor) => {
        acc[c.name] = c.color;
        return acc;
      }, {}),
    );

    const vendor = vendorsData.find((v) => v.id === vendorId);
    if (vendor) {
      setLoadingDocs(true);
      try {
        const docsRes = await fetch(`/api/vendors/${vendorId}/documents`);
        if (docsRes.ok) {
          const docsData = await docsRes.json();
          setVendorDocs(docsData);
        }
      } catch (err) {
        console.error("Failed to fetch vendor documents", err);
      } finally {
        setLoadingDocs(false);
      }
    }
  }, [vendorId]);

  useEffect(() => {
    (async () => {
      await fetchAll();
    })();
  }, [fetchAll]);

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
      <main className="animate-page content-container py-10">
        <p className="text-gray-400">
          {vendors.length === 0 ? "Loading…" : "Vendor not found"}
        </p>
      </main>
    );
  }

  async function handleSmartAction(doc: Document, action: SmartAction) {
    try {
      if (action.type === "COMPLETE_SCHEDULED") {
        await fetch(`/api/tasks/${action.taskId}/complete`, { method: "POST" });
      }
      const res = await fetch(`/api/tasks/${action.taskId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document: doc }),
      });
      if (res.ok) {
        setSuccessInfo({ title: action.taskTitle, docUrl: doc.url });
        await fetchAll();
      }
    } catch (err) {
      console.error("Smart action failed", err);
    }
  }

  async function handleManualMatch() {
    if (!matchingDoc) return;
    if (!createAsOccurrence && !selectedTaskId) return;
    try {
      let taskId = selectedTaskId;
      if (createAsOccurrence && occurrenceDate) {
        const templateTask = tasks.find((t) => t.title === selectedTaskTitle);
        if (!templateTask) return;
        const newTaskRes = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: templateTask.title,
            description: templateTask.description,
            frequency: templateTask.frequency,
            category: templateTask.category,
            start_date: occurrenceDate,
            status: "Completed",
            last_completed_date: occurrenceDate,
            estimated_cost: templateTask.estimated_cost,
            vendor_id: templateTask.vendor_id,
          }),
        });
        if (!newTaskRes.ok) throw new Error("Failed to create occurrence");
        const newTask = await newTaskRes.json();
        taskId = newTask.id;
      }
      const res = await fetch(`/api/tasks/${taskId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document: matchingDoc }),
      });
      if (res.ok) {
        setMatchingDoc(null);
        setSelectedTaskId("");
        setSelectedTaskTitle("");
        setCreateAsOccurrence(false);
        setOccurrenceDate("");
        await fetchAll();
      }
    } catch (err) {
      console.error("Manual match failed", err);
    }
  }

  async function handleCreateAndMatch() {
    if (!matchingDoc || !newTaskForm.title || !newTaskForm.category || !newTaskForm.start_date) return;
    try {
      const taskRes = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newTaskForm,
          frequency: newTaskForm.frequency || "Monthly",
          vendor_id: vendorId,
        }),
      });
      if (!taskRes.ok) throw new Error("Failed to create task");
      const newTaskData = await taskRes.json();
      const linkRes = await fetch(`/api/tasks/${newTaskData.id}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document: matchingDoc }),
      });
      if (linkRes.ok) {
        setMatchingDoc(null);
        setSelectedTaskTitle("");
        setSelectedTaskId("");
        setSuccessInfo({ title: newTaskForm.title, docUrl: matchingDoc.url });
        await fetchAll();
      }
    } catch (err) {
      console.error("Create and match failed", err);
    }
  }

  const distinctTaskTitles = Array.from(new Set(tasks.map((t) => t.title))).sort();
  const recurrences = selectedTaskTitle
    ? tasks
        .filter((t) => t.title === selectedTaskTitle)
        .sort((a, b) => (b.start_date || "").localeCompare(a.start_date || ""))
    : [];
  const past = recurrences.filter((t) => t.status === "Completed");
  const future = recurrences.filter((t) => t.status !== "Completed").reverse();
  const visibleRecurrences = [...future, ...past].sort((a, b) =>
    (b.start_date || "").localeCompare(a.start_date || ""),
  );

  const assignedTasks = tasks
    .filter((t) => t.vendor_id === vendorId)
    .sort((a, b) => (a.start_date || "").localeCompare(b.start_date || ""));
  const completed = assignedTasks.filter((t) => t.status === "Completed");
  const upcoming = assignedTasks.filter((t) => t.status !== "Completed");
  const totalCost = assignedTasks.reduce(
    (s, t) => s + (t.estimated_cost ?? 0),
    0,
  );
  const tasksWithCost = assignedTasks.filter((t) => t.estimated_cost != null);
  const avgCost =
    tasksWithCost.length > 0
      ? tasksWithCost.reduce((s, t) => s + (t.estimated_cost ?? 0), 0) /
        tasksWithCost.length
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
      paperless_correspondent_id: vendor.paperless_correspondent_id ?? null,
    };
    setForm(initial);
    setOriginalForm(initial);
    setEditOpen(true);
    setMenuOpen(false);
  };

  const closeEdit = () => {
    if (
      JSON.stringify(form) !== JSON.stringify(originalForm) &&
      !confirm("Discard unsaved changes?")
    )
      return;
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
    if (
      !confirm(
        `Archive "${vendor.name}"? It will be hidden from the main list but remain in the system.`,
      )
    )
      return;
    await fetch(`/api/vendors/${vendorId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: true }),
    });
    router.push("/vendors");
  };

  return (
    <>
      <main className="animate-page content-container py-10">
        <Link
          href="/vendors"
          className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 mb-8 inline-block"
        >
          ← Back
        </Link>

        {/* Header */}
        <div className="mb-12">
          <div className="flex items-start justify-between gap-6 mb-8">
            <div className="flex-1">
              <h1 className="text-4xl font-bold mb-3 text-gray-900 dark:text-gray-100">
                {vendor.name}
              </h1>
              <p className="text-base text-gray-600 dark:text-gray-400 leading-relaxed">
                {vendor.service_type}
              </p>
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
                  <button
                    onClick={openEdit}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-100 dark:border-gray-800"
                  >
                    Edit
                  </button>
                  {completed.length > 0 && (
                    <button
                      onClick={handleArchive}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-100 dark:border-gray-800"
                    >
                      Archive
                    </button>
                  )}
                  {canDelete && (
                    <button
                      onClick={handleDelete}
                      className="block w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950"
                    >
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
                  <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">
                    Total Tasks
                  </div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {assignedTasks.length}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">
                    Completed
                  </div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {completed.length}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">
                    Total Cost
                  </div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {fmt(totalCost)}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">
                    Avg. Cost
                  </div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {avgCost != null ? fmt(avgCost) : "—"}
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Contact Details */}
            <div className="space-y-3 text-sm">
              {vendor.phone && (
                <div className="flex justify-between gap-4">
                  <span className="text-gray-500 dark:text-gray-400">
                    Phone
                  </span>
                  <a
                    href={`tel:${vendor.phone}`}
                    className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                  >
                    {vendor.phone}
                  </a>
                </div>
              )}
              {vendor.email && (
                <div className="flex justify-between gap-4">
                  <span className="text-gray-500 dark:text-gray-400">
                    Email
                  </span>
                  <a
                    href={`mailto:${vendor.email}`}
                    className="text-blue-600 dark:text-blue-400 hover:underline font-medium text-right"
                  >
                    {vendor.email}
                  </a>
                </div>
              )}
              {vendor.address && (
                <div className="flex justify-between gap-4">
                  <span className="text-gray-500 dark:text-gray-400">
                    Location
                  </span>
                  <span className="font-medium text-gray-900 dark:text-gray-100 text-right">
                    {vendor.address}
                  </span>
                </div>
              )}
              {vendor.notes && (
                <div className="flex justify-between gap-4 pt-3 border-t border-gray-100 dark:border-gray-800">
                  <span className="text-gray-500 dark:text-gray-400">
                    Notes
                  </span>
                  <span className="text-gray-600 dark:text-gray-400 text-right">
                    {vendor.notes}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Work History & Documents */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <div>
            {upcoming.length > 0 && (
              <div className="mb-12">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-6">
                  Upcoming Work
                </h2>
                <div className="space-y-3">
                  {upcoming.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      vendors={vendors.map((v) => ({
                        id: v.id,
                        name: v.name,
                        service_type: v.service_type,
                      }))}
                      onCompleteAction={completeTask}
                      completing={completing}
                      categoryColors={categoryColors}
                    />
                  ))}
                </div>
              </div>
            )}

            {completed.length > 0 && (
              <div className="mb-8">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-6">
                  Completed Work
                </h2>
                <div className="space-y-3">
                  {completed.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      vendors={vendors.map((v) => ({
                        id: v.id,
                        name: v.name,
                        service_type: v.service_type,
                      }))}
                      onCompleteAction={completeTask}
                      completing={completing}
                      categoryColors={categoryColors}
                    />
                  ))}
                </div>
              </div>
            )}

            {assignedTasks.length === 0 && (
              <p className="text-sm text-gray-400 dark:text-gray-500">
                No tasks assigned to this vendor.
              </p>
            )}
          </div>

          <div>
            <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-6 flex items-center justify-between">
              Documents
              {loadingDocs && (
                <span className="text-[10px] animate-pulse normal-case font-normal">
                  Syncing...
                </span>
              )}
            </h2>
            {vendorDocs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-gray-400 border border-dashed border-gray-100 dark:border-gray-800 rounded-lg">
                <p className="text-xs text-center px-4">
                  {vendor.paperless_correspondent_id
                    ? "No documents found."
                    : "No Paperless correspondent linked."}
                </p>
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-lg overflow-hidden shadow-sm">
                <ul className="divide-y divide-gray-50 dark:divide-gray-800">
                  {vendorDocs
                    .sort((a, b) => (b.created || "").localeCompare(a.created || ""))
                    .map((doc) => (
                      <li
                        key={doc.id}
                        className="group p-4 hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span
                                className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${badgeColour(
                                  doc.document_type_label,
                                )}`}
                              >
                                {doc.document_type_label || "Document"}
                              </span>
                              <span className="text-[9px] text-gray-400 font-mono">
                                {doc.created ? format(parseISO(doc.created), "dd MMM yyyy") : "—"}
                              </span>
                            </div>
                            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                              {doc.title}
                            </h3>
                            {!doc.is_matched && doc.smart_actions.length > 0 && (
                              <div className="flex flex-wrap gap-2 mt-2">
                                {doc.smart_actions.map((action, i) => (
                                  <button
                                    key={i}
                                    onClick={() => handleSmartAction(doc, action)}
                                    className="text-[10px] px-2 py-1 bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-900 rounded hover:bg-amber-100 dark:hover:bg-amber-900 transition-colors"
                                  >
                                    {action.type === "MATCH_COMPLETED"
                                      ? `Match to ${format(parseISO(action.dateLabel), "MMM d")} completion`
                                      : `Match & Complete ${action.taskTitle}`}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <a
                              href={doc.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors px-2 py-1"
                            >
                              View ↗
                            </a>
                            {!doc.is_matched && (
                              <button
                                onClick={() => setMatchingDoc(doc)}
                                className="text-xs text-blue-600 dark:text-blue-400 hover:underline px-2 py-1"
                              >
                                Match
                              </button>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      </main>

      {editOpen && (
        <div
          ref={backdropRef}
          className="animate-backdrop fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === backdropRef.current) closeEdit();
          }}
        >
          <div className="animate-modal bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto flex flex-col p-8">
            <h2 className="text-2xl font-bold mb-8 text-gray-900 dark:text-gray-100 shrink-0">
              Edit Vendor
            </h2>
            <div className="space-y-5 flex-1 overflow-y-auto">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Name
                </label>
                <input
                  value={form.name ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  className={INPUT}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Service type
                </label>
                <input
                  value={form.service_type ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, service_type: e.target.value }))
                  }
                  className={INPUT}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Phone
                  </label>
                  <input
                    value={form.phone ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, phone: e.target.value }))
                    }
                    className={INPUT}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={form.email ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, email: e.target.value }))
                    }
                    className={INPUT}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Address
                </label>
                <input
                  value={form.address ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, address: e.target.value }))
                  }
                  className={INPUT}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Notes
                </label>
                <textarea
                  value={form.notes ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, notes: e.target.value }))
                  }
                  rows={3}
                  className={INPUT}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Paperless Correspondent
                </label>
                <select
                  value={form.paperless_correspondent_id ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      paperless_correspondent_id: e.target.value
                        ? parseInt(e.target.value, 10)
                        : null,
                    }))
                  }
                  className={INPUT}
                >
                  <option value="">None (No document matching)</option>
                  {correspondents.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
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

      {matchingDoc && (
        <div className="animate-backdrop fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="animate-modal bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full p-8">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">Match Document</h2>
            <div className="space-y-6">
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-md border border-gray-100 dark:border-gray-700">
                <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">Document</p>
                <p className="text-sm font-medium truncate">{matchingDoc.title}</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    1. Select Task Series
                  </label>
                  <select
                    value={selectedTaskTitle}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedTaskTitle(val);
                      setSelectedTaskId("");
                      if (val === "NEW TASK") {
                        setNewTaskForm({
                          title: matchingDoc.title,
                          category: categories[0] || "",
                          start_date: matchingDoc.created ? matchingDoc.created.split("T")[0] : "",
                          frequency: "",
                        });
                      }
                    }}
                    className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
                  >
                    <option value="">Select a task series...</option>
                    <option value="NEW TASK" className="font-bold text-blue-600">+ NEW TASK</option>
                    {distinctTaskTitles.map((title) => (
                      <option key={title} value={title}>{title}</option>
                    ))}
                  </select>
                </div>

                {selectedTaskTitle === "NEW TASK" && (
                  <div className="p-4 bg-blue-50/50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 rounded-lg space-y-4 animate-in fade-in slide-in-from-top-2">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-blue-400 mb-1">New Task Title</label>
                      <input
                        value={newTaskForm.title}
                        onChange={(e) => setNewTaskForm((f) => ({ ...f, title: e.target.value }))}
                        className="w-full border border-blue-100 dark:border-blue-900 bg-white dark:bg-gray-900 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-blue-400 mb-1">Category</label>
                        <select
                          value={newTaskForm.category}
                          onChange={(e) => setNewTaskForm((f) => ({ ...f, category: e.target.value }))}
                          className="w-full border border-blue-100 dark:border-blue-900 bg-white dark:bg-gray-900 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                        >
                          <option value="">Select category</option>
                          {categories.map((c) => (<option key={c} value={c}>{c}</option>))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-blue-400 mb-1">Start Date</label>
                        <input
                          type="date"
                          value={newTaskForm.start_date}
                          onChange={(e) => setNewTaskForm((f) => ({ ...f, start_date: e.target.value }))}
                          className="w-full border border-blue-100 dark:border-blue-900 bg-white dark:bg-gray-900 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-blue-400 mb-1">Frequency (leave blank for one-off)</label>
                      <select
                        value={newTaskForm.frequency}
                        onChange={(e) => setNewTaskForm((f) => ({ ...f, frequency: e.target.value }))}
                        className="w-full border border-blue-100 dark:border-blue-900 bg-white dark:bg-gray-900 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                      >
                        <option value="">One-off task</option>
                        <option value="Weekly">Weekly</option>
                        <option value="Bi-weekly">Bi-weekly</option>
                        <option value="Monthly">Monthly</option>
                        <option value="Quarterly">Quarterly</option>
                        <option value="Semi-Annually">Semi-Annually</option>
                        <option value="Annually">Annually</option>
                      </select>
                    </div>
                  </div>
                )}

                {selectedTaskTitle && selectedTaskTitle !== "NEW TASK" && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        2. Select Recurrence
                      </label>
                      <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                        {visibleRecurrences.map((task) => (
                          <button
                            key={task.id}
                            onClick={() => { setSelectedTaskId(task.id); setCreateAsOccurrence(false); }}
                            className={`w-full text-left p-3 rounded-md border transition-all ${
                              selectedTaskId === task.id && !createAsOccurrence
                                ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-500"
                                : "border-gray-100 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-900"
                            }`}
                          >
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium">
                                {task.last_completed_date
                                  ? format(parseISO(task.last_completed_date), "dd MMM yyyy")
                                  : format(parseISO(task.start_date), "dd MMM yyyy")}
                              </span>
                              <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                                task.status === "Completed"
                                  ? "bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400"
                                  : "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400"
                              }`}>
                                {task.status}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={createAsOccurrence}
                          onChange={(e) => { setCreateAsOccurrence(e.target.checked); if (!e.target.checked) setOccurrenceDate(""); }}
                          className="rounded border-gray-300 dark:border-gray-600"
                        />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Or create a custom occurrence</span>
                      </label>
                      {createAsOccurrence && (
                        <div className="mt-3 p-3 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900 rounded-md">
                          <label className="block text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400 mb-2">Date task occurred</label>
                          <input
                            type="date"
                            value={occurrenceDate}
                            onChange={(e) => setOccurrenceDate(e.target.value)}
                            className="w-full border border-blue-100 dark:border-blue-900 bg-white dark:bg-gray-900 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
                <button
                  onClick={() => { setMatchingDoc(null); setSelectedTaskTitle(""); setSelectedTaskId(""); setCreateAsOccurrence(false); setOccurrenceDate(""); }}
                  className="flex-1 text-sm px-4 py-2 rounded-md border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={selectedTaskTitle === "NEW TASK" ? handleCreateAndMatch : handleManualMatch}
                  disabled={
                    selectedTaskTitle === "NEW TASK"
                      ? !newTaskForm.title || !newTaskForm.category || !newTaskForm.start_date
                      : createAsOccurrence ? !occurrenceDate : !selectedTaskId
                  }
                  className="flex-1 text-sm px-4 py-2 rounded-md bg-gray-900 dark:bg-gray-700 text-white hover:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {selectedTaskTitle === "NEW TASK" ? "Create & Link" : "Link Document"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {successInfo && (
        <div className="animate-backdrop fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="animate-modal bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-sm w-full p-8 text-center">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-950 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 className="text-xl font-bold mb-2 text-gray-900 dark:text-gray-100">Task Completed!</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Document successfully linked to {successInfo.title}.</p>
            <div className="flex flex-col gap-2">
              <a href={successInfo.docUrl} target="_blank" rel="noopener noreferrer" className="text-sm px-4 py-2 rounded-md bg-gray-900 dark:bg-gray-700 text-white hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors font-medium">
                Preview Document ↗
              </a>
              <button onClick={() => setSuccessInfo(null)} className="text-sm px-4 py-2 rounded-md border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
