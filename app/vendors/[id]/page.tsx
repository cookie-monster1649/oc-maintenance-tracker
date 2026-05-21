"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { TaskCard, Task } from "../../components/TaskCard";
import type { LineItem } from "@/lib/line-items";
import { getCached, setCached } from "@/lib/cache";
import { badgeColour } from "@/lib/badge-colour";
import { format, parseISO } from "date-fns";
import { useGodMode } from "@/app/contexts/god-mode";
import { MODAL_BACKDROP, MODAL_CONTENT_LG } from "@/lib/ui-constants";
import { useDocumentMatching } from "@/app/components/matching/useDocumentMatching";
import { MatchDocumentModal } from "@/app/components/matching/MatchDocumentModal";
import { MatchDocumentErrorBoundary } from "@/app/components/matching/MatchDocumentErrorBoundary";
import DetailPageLayout from "@/app/components/DetailPageLayout";
import { getEffectiveVendorId, deduplicateTasks, getTaskPatterns } from "@/lib/detail-page-filters";
import NewTaskModal from "@/app/components/NewTaskModal";
import VendorModal from "@/app/components/VendorModal";
import type { Vendor as ApiVendor } from "@/lib/vendors";

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

interface PaperlessCorrespondent {
  id: number;
  name: string;
}

const INPUT =
  "w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-600";

function fmt(n: number): string {
  return n.toLocaleString("en-AU", { style: "currency", currency: "AUD" });
}

function groupByYear(
  items: Task[],
  dateField: "start_date" | "date" = "start_date",
) {
  const groups: { year: string; tasks: Task[] }[] = [];
  items.forEach((task) => {
    const date = (
      dateField === "date"
        ? task.last_completed_date || task.start_date
        : task.start_date
    ) || "0000";
    const year = date.split("-")[0];
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.year === year) {
      lastGroup.tasks.push(task);
    } else {
      groups.push({ year, tasks: [task] });
    }
  });
  return groups;
}

export default function VendorDetailPage() {
  const { godMode } = useGodMode();
  const params = useParams();
  const router = useRouter();
  const vendorId = params.id as string;

  const [vendors, setVendors] = useState<Vendor[]>(
    () => getCached<Vendor[]>("/api/vendors") ?? [],
  );
  const [tasks, setTasks] = useState<Task[]>(
    () => getCached<Task[]>("/api/tasks") ?? [],
  );
  const [lineItems, setLineItems] = useState<LineItem[]>(
    () => getCached<LineItem[]>("/api/line-items") ?? [],
  );
  const [vendorDocs, setVendorDocs] = useState<Document[]>([]);
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
  const [correspondents, setCorrespondents] = useState<PaperlessCorrespondent[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [completing, setCompleting] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [promptingCostFor, setPromptingCostFor] = useState<string | null>(null);
  const [costPromptValue, setCostPromptValue] = useState("");
  const [form, setForm] = useState<Partial<Vendor>>({});
  const [originalForm, setOriginalForm] = useState<Partial<Vendor>>({});
  const [selectedTaskPatterns, setSelectedTaskPatterns] = useState<string[]>([]);

  const menuRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  async function fetchTasks() {
    const res = await fetch("/api/tasks");
    const data = await res.json();
    setCached("/api/tasks", data);
    setTasks(data);
  }

  const fetchAll = useCallback(async () => {
    const [vendorsRes, tasksRes, lineItemsRes, categoriesRes, corrRes] = await Promise.all([
      fetch("/api/vendors"),
      fetch("/api/tasks"),
      fetch("/api/line-items"),
      fetch("/api/categories"),
      fetch("/api/paperless/correspondents").catch(() => null),
    ]);
    const [vendorsData, tasksData, lineItemsData, categoriesData, corrData] =
      (await Promise.all([
        vendorsRes.json(),
        tasksRes.json(),
        lineItemsRes.json(),
        categoriesRes.json(),
        corrRes ? corrRes.json() : Promise.resolve([]),
      ])) as [Vendor[], Task[], LineItem[], CategoryColor[], PaperlessCorrespondent[]];
    setCached("/api/vendors", vendorsData);
    setCached("/api/tasks", tasksData);
    setCached("/api/line-items", lineItemsData);
    setCached("/api/categories", categoriesData);
    setVendors(vendorsData);
    setTasks(tasksData);
    setLineItems(lineItemsData);
    setCategories(categoriesData.map((c: CategoryColor) => c.name));
    setCorrespondents(Array.isArray(corrData) ? corrData : []);
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

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  // Document matching hook
  const {
    matchingDoc,
    setMatchingDoc,
    selectedSeriesId,
    setSelectedSeriesId,
    setSelectedSeriesTitle,
    selectedTaskId,
    setSelectedTaskId,
    selectedVendorId,
    setSelectedVendorId,
    createAsOccurrence,
    setCreateAsOccurrence,
    occurrenceDate,
    setOccurrenceDate,
    confirmedDate,
    setConfirmedDate,
    newTaskForm,
    setNewTaskForm,
    handleManualMatch,
    handleManualMatchAndComplete,
    handleSmartAction: hookHandleSmartAction,
    handleCreateAndMatch,
    handleLinkToLineItem,
    handleLinkToVendor,
  } = useDocumentMatching({
    tasks,
    defaultVendorId: vendorId,
    onSuccess: fetchAll,
  });

  async function completeTask(id: string) {
    const task = tasks.find((t) => t.id === id);
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
    await fetchTasks();
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

  const handleSmartAction = (doc: Document, action: SmartAction) => {
    hookHandleSmartAction(doc, {
      type: action.type,
      taskId: action.taskId,
      taskTitle: action.taskTitle,
    });
  };

  // Filter tasks by effective vendor
  const lineItemVendorMap = new Map(lineItems.map((li) => [li.id, li.vendor_id]));
  const assignedTasks = tasks.filter((t) => {
    const effectiveVendorId = getEffectiveVendorId(t, lineItemVendorMap);
    return effectiveVendorId === vendorId;
  });

  const filterBySelectedPatterns = <T extends { title?: string | null; frequency?: string | null }>(list: T[]): T[] => {
    if (selectedTaskPatterns.length === 0) return list;
    return list.filter((t) => {
      const patternKey = `${t.title ?? ""}|${t.frequency ?? ""}`;
      return selectedTaskPatterns.includes(patternKey);
    });
  };

  const completed = filterBySelectedPatterns(
    assignedTasks
      .filter((t) => t.status === "Completed")
      .sort((a, b) => (b.start_date || "").localeCompare(a.start_date || "")),
  );
  const upcoming = filterBySelectedPatterns(
    deduplicateTasks(
      assignedTasks
        .filter((t) => t.status !== "Completed")
        .sort((a, b) => (a.start_date || "").localeCompare(b.start_date || "")),
    ),
  );

  const totalCost = assignedTasks.reduce(
    (s, t) => s + (t.estimated_cost ?? 0),
    0,
  );
  const openEdit = () => {
    const initial = {
      name: vendor.name,
      service_type: vendor.service_type,
      email: vendor.email,
      phone: vendor.phone,
      address: vendor.address,
      notes: vendor.notes,
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

  // Header left content (Budget/Actuals - OC-Y summary)
  const headerLeftContent = (
    <div className="space-y-4">
      <div className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
        FY{new Date().getFullYear() + (new Date().getMonth() >= 6 ? 1 : 0)}
      </div>
      <div>
        <div className="flex flex-col md:flex-row md:gap-12 gap-2 text-sm">
          <div>
            <div className="text-gray-500 dark:text-gray-400">Budget</div>
            <div className="font-bold text-gray-900 dark:text-gray-100">
              {fmt(totalCost)}
            </div>
          </div>
          <div>
            <div className="text-gray-500 dark:text-gray-400">Actuals</div>
            <div className="font-bold text-gray-900 dark:text-gray-100">
              {fmt(completed.reduce((s, t) => s + (t.actual_cost ?? t.estimated_cost ?? 0), 0))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Header right content (Contact details)
  const headerRightContent = (
    <div className="space-y-3 text-sm">
      {vendor.phone && (
        <div className="flex flex-col md:flex-row md:justify-between gap-1 md:gap-4">
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
        <div className="flex flex-col md:flex-row md:justify-between gap-1 md:gap-4">
          <span className="text-gray-500 dark:text-gray-400">
            Email
          </span>
          <a
            href={`mailto:${vendor.email}`}
            className="text-blue-600 dark:text-blue-400 hover:underline font-medium md:text-right break-all"
          >
            {vendor.email}
          </a>
        </div>
      )}
      {vendor.address && (
        <div className="flex flex-col md:flex-row md:justify-between gap-1 md:gap-4">
          <span className="text-gray-500 dark:text-gray-400">
            Location
          </span>
          <span className="font-medium text-gray-900 dark:text-gray-100 md:text-right">
            {vendor.address}
          </span>
        </div>
      )}
      {vendor.notes && (
        <div className="flex flex-col md:flex-row md:justify-between gap-1 md:gap-4 pt-3 border-t border-gray-100 dark:border-gray-800">
          <span className="text-gray-500 dark:text-gray-400">
            Notes
          </span>
          <span className="text-gray-600 dark:text-gray-400 md:text-right">
            {vendor.notes}
          </span>
        </div>
      )}
    </div>
  );

  // Menu button
  const menuButton = godMode ? (
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
          <button
            onClick={handleDelete}
            className="block w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  ) : null;

  // Task patterns section
  const taskPatternsSection = assignedTasks.length > 0 ? (
    <div className="mb-12 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-100 dark:border-gray-800">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-4">
        ── Tasks ──
      </h2>
      <div className="space-y-2 pl-5">
        {(() => {
          const patterns = getTaskPatterns(assignedTasks);
          return Array.from(patterns.entries()).map(([key, pattern]) => {
            const patternTask = assignedTasks.find(
              (t) => (t.title || "Untitled") === pattern.title && t.frequency === pattern.frequency,
            );
            const lineItemId = patternTask?.line_item_id;
            const patternKey = `${pattern.title}|${pattern.frequency ?? ""}`;
            const isSelected = selectedTaskPatterns.includes(patternKey);

            const togglePattern = () => {
              if (isSelected) {
                setSelectedTaskPatterns(selectedTaskPatterns.filter((p) => p !== patternKey));
              } else {
                setSelectedTaskPatterns([...selectedTaskPatterns, patternKey]);
              }
            };

            return (
              <div key={key} className="flex items-center text-sm group">
                <button
                  onClick={togglePattern}
                  className={`flex-1 text-left px-2 py-1 rounded cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 font-medium"
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800"
                  }`}
                >
                  {pattern.title}
                  {pattern.frequency && (
                    <>
                      <span className="mx-3 text-gray-400 dark:text-gray-500">•</span>
                      <span className={isSelected ? "text-gray-100 dark:text-gray-800" : "text-gray-500 dark:text-gray-400"}>
                        {pattern.frequency}
                      </span>
                    </>
                  )}
                  {(pattern.estimated_cost != null || pattern.actual_cost != null) && (
                    <>
                      <span className="mx-3 text-gray-400 dark:text-gray-500">•</span>
                      <span className={isSelected ? "text-gray-100 dark:text-gray-800" : "text-gray-500 dark:text-gray-400"}>
                        {pattern.actual_cost != null
                          ? `Est $${pattern.estimated_cost ?? 0} / Act $${pattern.actual_cost}`
                          : `$${pattern.estimated_cost}`}
                      </span>
                    </>
                  )}
                </button>
                {lineItemId && (
                  <a
                    href={`/line-items/${lineItemId}`}
                    className="opacity-0 group-hover:opacity-100 ml-2 text-xs text-blue-500 dark:text-blue-400 hover:underline transition-opacity"
                    title="Go to line item"
                  >
                    →
                  </a>
                )}
              </div>
            );
          });
        })()}
      </div>
    </div>
  ) : null;

  // Tasks and documents section
  const upcomingGroups = groupByYear(upcoming);
  const completedGroups = groupByYear(completed);
  const tasksAndDocumentsSection = (
    <section className="grid grid-cols-1 md:grid-cols-2 gap-12">
      <div>
        {upcoming.length > 0 && (
          <div className="mb-12">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-6">
              Upcoming Work ({upcoming.length})
            </h2>
            <div className="space-y-6">
              {(() => {
                const currentYear = new Date().getFullYear().toString();
                const showYears = upcomingGroups.some((g) => g.year !== currentYear);
                return upcomingGroups.map((group) => (
                  <div key={group.year} className="space-y-3">
                    {showYears && (
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
                          vendors={vendors.map((v) => ({
                            id: v.id,
                            name: v.name,
                            service_type: v.service_type,
                          }))}
                          onCompleteAction={completeTask}
                          completing={completing}
                          categoryColors={categoryColors}
                          onUnlinkDocumentAction={handleUnlinkDocument}
                          onEditAction={handleEditTask}
                          showVendor={false}
                        />
                      );
                    })}
                  </div>
                ));
              })()}
            </div>
          </div>
        )}

        {completed.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-6">
              Completed Work ({completed.length})
            </h2>
            <div className="space-y-8">
              {(() => {
                const currentYear = new Date().getFullYear().toString();
                const showYears = completedGroups.some((g) => g.year !== currentYear);
                return completedGroups.map((group) => (
                  <div key={group.year} className="space-y-3">
                    {showYears && (
                      <div className="pt-2 border-b border-gray-100 dark:border-gray-800 mb-2">
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
                          vendors={vendors.map((v) => ({
                            id: v.id,
                            name: v.name,
                            service_type: v.service_type,
                          }))}
                          onCompleteAction={completeTask}
                          completing={completing}
                          categoryColors={categoryColors}
                          onUnlinkDocumentAction={handleUnlinkDocument}
                          onEditAction={handleEditTask}
                          showVendor={false}
                        />
                      );
                    })}
                  </div>
                ));
              })()}
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
                                  : <>Match & Complete {action.taskTitle} on <strong>{format(parseISO(action.dateLabel), "MMMM d yyyy")}</strong></>}
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
  );

  return (
    <>
      <DetailPageLayout
        backHref="/vendors"
        title={vendor.name}
        subtitle={vendor.service_type}
        menuButton={menuButton}
        headerLeftContent={headerLeftContent}
        headerRightContent={headerRightContent}
        taskPatternsSection={taskPatternsSection}
        tasksAndDocumentsSection={tasksAndDocumentsSection}
      />

      <VendorModal
        isOpen={editOpen}
        editing={vendor}
        form={form as Parameters<typeof VendorModal>[0]['form']}
        setForm={(newForm) => setForm(newForm)}
        correspondents={correspondents}
        onClose={closeEdit}
        onSave={saveEdit}
      />

      <MatchDocumentErrorBoundary>
        {matchingDoc && (
          <MatchDocumentModal
            doc={matchingDoc}
            tasks={tasks}
            lineItems={lineItems}
            vendors={vendors}
            categories={categories}
            selectedSeriesId={selectedSeriesId}
            setSelectedSeriesId={setSelectedSeriesId}
            setSelectedSeriesTitle={setSelectedSeriesTitle}
            selectedTaskId={selectedTaskId}
            setSelectedTaskId={setSelectedTaskId}
            selectedVendorId={selectedVendorId}
            setSelectedVendorId={setSelectedVendorId}
            createAsOccurrence={createAsOccurrence}
            setCreateAsOccurrence={setCreateAsOccurrence}
            occurrenceDate={occurrenceDate}
            setOccurrenceDate={setOccurrenceDate}
            confirmedDate={confirmedDate}
            setConfirmedDate={setConfirmedDate}
            newTaskForm={newTaskForm}
            setNewTaskForm={setNewTaskForm}
            onManualMatch={handleManualMatch}
            onManualMatchAndComplete={handleManualMatchAndComplete}
            onCreateAndMatch={handleCreateAndMatch}
            onCreateAndMatchComplete={handleCreateAndMatch}
            onLinkToLineItem={handleLinkToLineItem}
            onLinkToVendor={handleLinkToVendor}
            onClose={() => setMatchingDoc(null)}
          />
        )}
      </MatchDocumentErrorBoundary>

      {editingTaskId && (() => {
        const editingTask = tasks.find((t) => t.id === editingTaskId);
        return (
          <NewTaskModal
            isOpen={!!editingTaskId}
            mode="edit"
            lineItems={lineItems}
            categories={categories}
            vendors={vendors as unknown as Parameters<typeof NewTaskModal>[0]['vendors']}
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
