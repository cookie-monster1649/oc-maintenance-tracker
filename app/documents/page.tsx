"use client";

import { useState, useEffect } from "react";
import { badgeColour } from "@/lib/badge-colour";
import { format, parseISO } from "date-fns";
import { useCachedData, invalidateCache } from "@/lib/data";
import { useGodMode } from "@/app/contexts/god-mode";

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
  correspondent: number | null;
  tag_names: string[];
  document_type_id: number | null;
  document_type_label: string | null;
  created?: string;
  url: string;
  is_matched: boolean;
  is_dismissed: boolean;
  smart_actions: SmartAction[];
}

interface Task {
  id: string;
  title: string;
  description: string;
  frequency: string;
  category: string;
  last_completed_date: string | null;
  start_date: string;
  status: string;
  vendor_id: string | null;
  estimated_cost: number | null;
  archived?: boolean;
  documents?: Array<{
    id: number;
    title: string;
    url: string;
  }>;
}

export default function DocumentsPage() {
  const { godMode } = useGodMode();
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const { data: documentsData, isRefreshing: isDocsRefreshing } = useCachedData(
    "/api/paperless/documents",
    refreshTrigger,
  );
  const { data: tasksData, isRefreshing: isTasksRefreshing } = useCachedData(
    "/api/tasks",
    refreshTrigger,
  );
  const { data: categoriesData, isRefreshing: isCatsRefreshing } = useCachedData(
    "/api/categories",
    refreshTrigger,
  );
  const { data: vendorsData, isRefreshing: isVendorsRefreshing } = useCachedData(
    "/api/vendors",
    refreshTrigger,
  );

  const documents: Document[] = Array.isArray(documentsData) ? documentsData : [];
  const tasks: Task[] = Array.isArray(tasksData) ? tasksData : [];
  const categories: string[] = Array.isArray(categoriesData)
    ? (categoriesData as { name: string }[]).map((c) => c.name)
    : [];
  const vendors = Array.isArray(vendorsData) ? vendorsData : [];

  const [unmatchedOnly, setUnmatchedOnly] = useState(true);
  const [matchingDoc, setMatchingDoc] = useState<Document | null>(null);
  const [isCreatingVendor, setIsCreatingVendor] = useState(false);
  const [selectedTaskTitle, setSelectedTaskTitle] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState("");

  const [successInfo, setSuccessInfo] = useState<{
    title: string;
    docUrl: string;
  } | null>(null);
  const [vendorError, setVendorError] = useState<string>("");

  const [newTaskForm, setNewTaskForm] = useState({
    title: "",
    description: "",
    category: "",
    start_date: "",
    frequency: "",
    vendor_id: "",
    estimated_cost: "",
  });

  const [newVendorForm, setNewVendorForm] = useState({
    name: "",
    service_type: "",
  });

  const [createAsOccurrence, setCreateAsOccurrence] = useState(false);
  const [occurrenceDate, setOccurrenceDate] = useState("");
  const [selectedTab, setSelectedTab] = useState<string>("");

  const refreshAll = () => {
    invalidateCache("/api/paperless/documents");
    invalidateCache("/api/tasks");
    invalidateCache("/api/categories");
    // Trigger refetch by incrementing counter
    setRefreshTrigger((t) => t + 1);
  };

  async function handleManualMatch() {
    if (!matchingDoc) return;
    if (!createAsOccurrence && !selectedTaskId) return;

    try {
      let taskId = selectedTaskId;

      // If creating as custom occurrence, create a new completed task instance
      if (createAsOccurrence && occurrenceDate) {
        // Find any task with the selected title to get the properties
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
            no_extrapolate: true,
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
        refreshAll();
      }
    } catch (err) {
      console.error("Manual match failed", err);
    }
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
        refreshAll();
      }
    } catch (err) {
      console.error("Smart action failed", err);
    }
  }

  async function handleCreateVendor() {
    if (!newVendorForm.name || !matchingDoc?.correspondent) return;

    try {
      setVendorError("");
      const res = await fetch("/api/vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newVendorForm,
          paperless_correspondent_id: matchingDoc.correspondent,
        }),
      });

      if (res.ok) {
        setIsCreatingVendor(false);
        setNewVendorForm({ name: "", service_type: "" });
        refreshAll();
      } else {
        const error = await res.text();
        setVendorError(`Failed to create vendor: ${res.status} ${error}`);
      }
    } catch (err) {
      console.error("Create vendor failed", err);
      setVendorError(`Error creating vendor: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function handleCreateAndMatch() {
    if (
      !matchingDoc ||
      !newTaskForm.title ||
      !newTaskForm.category ||
      !newTaskForm.start_date
    )
      return;

    try {
      const taskBody: Record<string, unknown> = {
        title: newTaskForm.title,
        description: newTaskForm.description || "",
        category: newTaskForm.category,
        start_date: newTaskForm.start_date,
        frequency: newTaskForm.frequency || "Monthly",
        status: "Completed",
        last_completed_date: newTaskForm.start_date,
      };
      if (newTaskForm.vendor_id) {
        taskBody.vendor_id = newTaskForm.vendor_id;
      }
      if (newTaskForm.estimated_cost) {
        taskBody.estimated_cost = Number(newTaskForm.estimated_cost);
      }

      const taskRes = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(taskBody),
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
        refreshAll();
      }
    } catch (err) {
      console.error("Create and match failed", err);
    }
  }

  const latestByTitle = tasks.reduce(
    (acc, t) => {
      if (!acc[t.title] || (t.start_date || "") > (acc[t.title].start_date || "")) {
        acc[t.title] = t;
      }
      return acc;
    },
    {} as Record<string, Task>,
  );
  const distinctTaskTitles = Object.entries(latestByTitle)
    .filter(([, t]) => t.archived !== true)
    .map(([title]) => title)
    .sort();

  const recurrences = selectedTaskTitle
    ? tasks
        .filter((t) => t.title === selectedTaskTitle && t.archived !== true)
        .sort((a, b) => (b.start_date || "").localeCompare(a.start_date || ""))
    : [];

  const past = recurrences.filter((t) => t.status === "Completed");
  const future = recurrences.filter((t) => t.status !== "Completed").reverse();
  const visibleRecurrences = [...future, ...past].sort((a, b) =>
    (b.start_date || "").localeCompare(a.start_date || ""),
  );

  const filteredDocs = unmatchedOnly
    ? documents.filter((doc) => !doc.is_matched && !doc.is_dismissed)
    : documents;

  const groupedByType: Record<string, Document[]> = {};
  filteredDocs.forEach((doc) => {
    const type = doc.document_type_label || "Uncategorized";
    if (!groupedByType[type]) groupedByType[type] = [];
    groupedByType[type].push(doc);
  });

  const statsByType: Record<string, { matched: number; total: number }> = {};
  documents.forEach((doc) => {
    const type = doc.document_type_label || "Uncategorized";
    if (!statsByType[type]) statsByType[type] = { matched: 0, total: 0 };
    statsByType[type].total++;
    if (doc.is_matched) statsByType[type].matched++;
  });

  const sortedTypes = Object.keys(groupedByType).sort();

  useEffect(() => {
    if (!selectedTab && sortedTypes.length > 0) {
      setSelectedTab(sortedTypes[0]);
    }
  }, [sortedTypes, selectedTab]);

  const isRefreshing =
    isDocsRefreshing || isTasksRefreshing || isCatsRefreshing;

  return (
    <>
      <main
        className={`animate-page content-container py-10 ${isRefreshing ? "opacity-75 transition-opacity duration-300" : ""}`}
      >
        <div className="flex items-start justify-between gap-8 mb-8">
          <div>
            <h1 className="text-2xl font-semibold mb-1 text-gray-900 dark:text-gray-100">
              Documents
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              All documents from Paperless-ngx
            </p>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={unmatchedOnly}
                onChange={(e) => setUnmatchedOnly(e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-700 text-gray-900 focus:ring-gray-500"
              />
              Unmatched only
            </label>
            <button
              onClick={refreshAll}
              disabled={isRefreshing}
              className="text-sm px-3 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              Refresh
            </button>
          </div>
        </div>

        {!documentsData ? (
          <div className="space-y-12">
            {[1, 2].map((i) => (
              <div key={i} className="space-y-4">
                <div className="h-4 w-32 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-lg shadow-sm">
                  <div className="divide-y divide-gray-50 dark:divide-gray-800">
                    {[1, 2, 3].map((j) => (
                      <div
                        key={j}
                        className="p-4 flex items-center justify-between"
                      >
                        <div className="flex-1 flex items-center gap-4">
                          <div className="flex flex-col gap-1">
                            <div className="h-3 w-16 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                            <div className="h-3 w-20 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                          </div>
                          <div className="h-4 w-64 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                        </div>
                        <div className="h-8 w-16 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500 border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-lg">
            <p>No {unmatchedOnly ? "unmatched" : ""} documents found.</p>
          </div>
        ) : (
          <div>
            <div className="flex gap-2 border-b border-gray-200 dark:border-gray-800 mb-8 overflow-x-auto">
              {sortedTypes.map((type) => (
                <button
                  key={type}
                  onClick={() => setSelectedTab(type)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    selectedTab === type
                      ? "border-gray-900 dark:border-gray-100 text-gray-900 dark:text-gray-100"
                      : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                  }`}
                >
                  <span>{type}</span>
                  <span className="ml-2 text-[10px] font-mono text-gray-400 dark:text-gray-500">
                    ({statsByType[type].total - statsByType[type].matched}/{statsByType[type].total})
                  </span>
                </button>
              ))}
            </div>

            {selectedTab && (
              <div>
                <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-lg overflow-hidden shadow-sm">
                  <ul className="divide-y divide-gray-50 dark:divide-gray-800">
                    {groupedByType[selectedTab]
                      .sort((a, b) => (b.created || "").localeCompare(a.created || ""))
                      .map((doc) => (
                        <li
                          key={`${selectedTab}-${doc.id}`}
                          className="group flex items-center justify-between p-4 hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors"
                        >
                          <div className="min-w-0 flex-1 flex items-center gap-4">
                            <div className="flex flex-col items-start gap-1">
                              <span
                                className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${badgeColour(
                                  doc.document_type_label,
                                )}`}
                              >
                                {doc.document_type_label || "Document"}
                              </span>
                              <span className="text-[10px] text-gray-400 font-mono">
                                {doc.created ? format(parseISO(doc.created), "dd MMM yyyy") : "—"}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                {doc.title}
                              </h3>
                              <div className="flex flex-wrap gap-2 mt-2">
                                {godMode &&
                                  !doc.is_matched &&
                                  !doc.is_dismissed &&
                                  doc.smart_actions.map((action, i) => (
                                    <button
                                      key={i}
                                      onClick={() =>
                                        handleSmartAction(doc, action)
                                      }
                                      className="text-[10px] px-2 py-1 bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-900 rounded hover:bg-amber-100 dark:hover:bg-amber-900 transition-colors"
                                    >
                                      {action.type === "MATCH_COMPLETED"
                                        ? `Match to ${format(
                                            parseISO(action.dateLabel),
                                            "MMM d",
                                          )} completion`
                                        : `Match & Complete ${action.taskTitle}`}
                                    </button>
                                  ))}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-4">
                            <a
                              href={doc.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors flex items-center gap-1 px-2 py-1"
                            >
                              View ↗
                            </a>
                            {doc.is_dismissed && (
                              <button
                                onClick={async () => {
                                  await fetch(
                                    `/api/documents/${doc.id}/dismiss`,
                                    { method: "DELETE" },
                                  );
                                  refreshAll();
                                }}
                                className="text-xs text-rose-600 dark:text-rose-400 hover:underline px-2 py-1"
                              >
                                Undo Dismiss
                              </button>
                            )}
                            {godMode && !doc.is_matched && !doc.is_dismissed && (
                              <button
                                onClick={() => setMatchingDoc(doc)}
                                className="text-xs text-blue-600 dark:text-blue-400 hover:underline px-2 py-1"
                              >
                                Match
                              </button>
                            )}
                          </div>
                        </li>
                      ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {matchingDoc && (
        <div className="animate-backdrop fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="animate-modal bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {isCreatingVendor
                  ? "New Vendor for Correspondent"
                  : "Match Document"}
              </h2>
              {!isCreatingVendor && (
                <button
                  onClick={() => {
                    setNewVendorForm({ name: "", service_type: "" });
                    setVendorError("");
                    setIsCreatingVendor(true);
                  }}
                  className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900 px-2 py-1 rounded hover:bg-emerald-50 dark:hover:bg-emerald-950 transition-colors"
                >
                  Make new vendor
                </button>
              )}
              {isCreatingVendor && (
                <button
                  onClick={() => {
                    setIsCreatingVendor(false);
                    setVendorError("");
                  }}
                  className="text-xs font-bold text-gray-500 hover:underline"
                >
                  Back to matching
                </button>
              )}
            </div>

            <div className="space-y-6">
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-md border border-gray-100 dark:border-gray-700">
                <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">
                  Document
                </p>
                <p className="text-sm font-medium truncate">
                  {matchingDoc.title}
                </p>
              </div>

              {!isCreatingVendor ? (
                <>
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
                              description: "",
                              category: categories[0] || "",
                              start_date: matchingDoc.created ? matchingDoc.created.split("T")[0] : "",
                              frequency: "",
                              vendor_id: "",
                              estimated_cost: "",
                            });
                          }
                        }}
                        className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
                      >
                        <option value="">Select a task series...</option>
                        <option
                          value="NEW TASK"
                          className="font-bold text-blue-600"
                        >
                          + NEW TASK
                        </option>
                        {distinctTaskTitles.map((title) => (
                          <option key={title} value={title}>
                            {title}
                          </option>
                        ))}
                      </select>
                    </div>

                    {selectedTaskTitle === "NEW TASK" && (
                      <div className="p-4 bg-blue-50/50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 rounded-lg space-y-4 animate-in fade-in slide-in-from-top-2">
                        <div>
                          <label className="block text-[10px] uppercase font-bold text-blue-400 mb-1">
                            New Task Title
                          </label>
                          <input
                            value={newTaskForm.title}
                            onChange={(e) =>
                              setNewTaskForm((f) => ({
                                ...f,
                                title: e.target.value,
                              }))
                            }
                            className="w-full border border-blue-100 dark:border-blue-900 bg-white dark:bg-gray-900 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase font-bold text-blue-400 mb-1">
                            Description
                          </label>
                          <textarea
                            value={newTaskForm.description}
                            onChange={(e) =>
                              setNewTaskForm((f) => ({
                                ...f,
                                description: e.target.value,
                              }))
                            }
                            placeholder="Task details and notes..."
                            rows={2}
                            className="w-full border border-blue-100 dark:border-blue-900 bg-white dark:bg-gray-900 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] uppercase font-bold text-blue-400 mb-1">
                              Category
                            </label>
                            <select
                              value={newTaskForm.category}
                              onChange={(e) =>
                                setNewTaskForm((f) => ({
                                  ...f,
                                  category: e.target.value,
                                }))
                              }
                              className="w-full border border-blue-100 dark:border-blue-900 bg-white dark:bg-gray-900 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                            >
                              <option value="">Select category</option>
                              {categories.map((c) => (
                                <option key={c} value={c}>
                                  {c}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] uppercase font-bold text-blue-400 mb-1">
                              Start Date
                            </label>
                            <input
                              type="date"
                              value={newTaskForm.start_date}
                              onChange={(e) =>
                                setNewTaskForm((f) => ({
                                  ...f,
                                  start_date: e.target.value,
                                }))
                              }
                              className="w-full border border-blue-100 dark:border-blue-900 bg-white dark:bg-gray-900 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase font-bold text-blue-400 mb-1">
                            Frequency (leave blank for one-off)
                          </label>
                          <select
                            value={newTaskForm.frequency}
                            onChange={(e) =>
                              setNewTaskForm((f) => ({
                                ...f,
                                frequency: e.target.value,
                              }))
                            }
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
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] uppercase font-bold text-blue-400 mb-1">
                              Vendor (optional)
                            </label>
                            <select
                              value={newTaskForm.vendor_id}
                              onChange={(e) =>
                                setNewTaskForm((f) => ({
                                  ...f,
                                  vendor_id: e.target.value,
                                }))
                              }
                              className="w-full border border-blue-100 dark:border-blue-900 bg-white dark:bg-gray-900 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                            >
                              <option value="">No vendor</option>
                              {vendors.map((v: { id: string; name: string; service_type: string }) => (
                                <option key={v.id} value={v.id}>
                                  {v.name} ({v.service_type})
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] uppercase font-bold text-blue-400 mb-1">
                              Estimated Cost (optional)
                            </label>
                            <input
                              type="number"
                              value={newTaskForm.estimated_cost}
                              onChange={(e) =>
                                setNewTaskForm((f) => ({
                                  ...f,
                                  estimated_cost: e.target.value,
                                }))
                              }
                              placeholder="0.00"
                              className="w-full border border-blue-100 dark:border-blue-900 bg-white dark:bg-gray-900 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                            />
                          </div>
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
                                onClick={() => {
                                  setSelectedTaskId(task.id);
                                  setCreateAsOccurrence(false);
                                }}
                                className={`w-full text-left p-3 rounded-md border transition-all ${
                                  selectedTaskId === task.id && !createAsOccurrence
                                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-500"
                                    : "border-gray-100 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-900"
                                }`}
                              >
                                <div className="flex justify-between items-center">
                                  <span className="text-sm font-medium">
                                    {task.last_completed_date
                                      ? format(
                                          parseISO(task.last_completed_date),
                                          "dd MMM yyyy",
                                        )
                                      : format(
                                          parseISO(task.start_date),
                                          "dd MMM yyyy",
                                        )}
                                  </span>
                                  <span
                                    className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                                      task.status === "Completed"
                                        ? "bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400"
                                        : "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400"
                                    }`}
                                  >
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
                              onChange={(e) => {
                                setCreateAsOccurrence(e.target.checked);
                                if (!e.target.checked) {
                                  setOccurrenceDate("");
                                }
                              }}
                              className="rounded border-gray-300 dark:border-gray-600"
                            />
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              Or create a custom occurrence
                            </span>
                          </label>
                          {createAsOccurrence && (
                            <div className="mt-3 p-3 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900 rounded-md">
                              <label className="block text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400 mb-2">
                                Date task occurred
                              </label>
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
                      onClick={() => {
                        setMatchingDoc(null);
                        setSelectedTaskTitle("");
                        setSelectedTaskId("");
                        setCreateAsOccurrence(false);
                        setOccurrenceDate("");
                      }}
                      className="flex-1 text-sm px-4 py-2 rounded-md border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={
                        selectedTaskTitle === "NEW TASK"
                          ? handleCreateAndMatch
                          : handleManualMatch
                      }
                      disabled={
                        selectedTaskTitle === "NEW TASK"
                          ? !newTaskForm.title ||
                            !newTaskForm.category ||
                            !newTaskForm.start_date
                          : createAsOccurrence
                            ? !occurrenceDate
                            : !selectedTaskId
                      }
                      className="flex-1 text-sm px-4 py-2 rounded-md bg-gray-900 dark:bg-gray-700 text-white hover:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium"
                    >
                      {selectedTaskTitle === "NEW TASK"
                        ? "Create & Link"
                        : "Link Document"}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {vendorError && (
                    <div className="p-3 bg-rose-50 dark:bg-rose-950 border border-rose-200 dark:border-rose-800 rounded-md">
                      <p className="text-sm text-rose-700 dark:text-rose-400">{vendorError}</p>
                    </div>
                  )}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                        Vendor Name
                      </label>
                      <input
                        value={newVendorForm.name}
                        onChange={(e) =>
                          setNewVendorForm((f) => ({
                            ...f,
                            name: e.target.value,
                          }))
                        }
                        placeholder="e.g. Acme Services"
                        className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                        Service Type
                      </label>
                      <input
                        value={newVendorForm.service_type}
                        onChange={(e) =>
                          setNewVendorForm((f) => ({
                            ...f,
                            service_type: e.target.value,
                          }))
                        }
                        placeholder="e.g. Electrician"
                        className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={handleCreateVendor}
                      disabled={!newVendorForm.name}
                      className="flex-1 text-sm px-4 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 transition-colors font-medium"
                    >
                      Create Vendor
                    </button>
                    <button
                      onClick={() => setIsCreatingVendor(false)}
                      className="flex-1 text-sm px-4 py-2 rounded-md border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {successInfo && (
        <div className="animate-backdrop fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="animate-modal bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-sm w-full p-8 text-center">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-950 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 className="text-xl font-bold mb-2 text-gray-900 dark:text-gray-100">
              Task Completed!
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Document successfully linked to {successInfo.title}.
            </p>
            <div className="flex flex-col gap-2">
              <a
                href={successInfo.docUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm px-4 py-2 rounded-md bg-gray-900 dark:bg-gray-700 text-white hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors font-medium"
              >
                Preview Document ↗
              </a>
              <button
                onClick={() => setSuccessInfo(null)}
                className="text-sm px-4 py-2 rounded-md border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
