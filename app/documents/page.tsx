"use client";

import { useState, useEffect } from "react";
import { badgeColour } from "@/lib/badge-colour";
import { format, parseISO } from "date-fns";
import { useCachedData, invalidateCache } from "@/lib/data";
import { useGodMode } from "@/app/contexts/god-mode";
import { useDocumentMatching } from "@/app/components/matching/useDocumentMatching";
import { MatchDocumentModal } from "@/app/components/matching/MatchDocumentModal";
import { MatchDocumentErrorBoundary } from "@/app/components/matching/MatchDocumentErrorBoundary";
import { SmartActionConfirmModal } from "@/app/components/matching/SmartActionConfirmModal";
import { MatchSuccessModal } from "@/app/components/matching/MatchSuccessModal";

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
  series_id: string;
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
  const [isCreatingVendor, setIsCreatingVendor] = useState(false);
  const [selectedTab, setSelectedTab] = useState<string>("");

  const [newVendorForm, setNewVendorForm] = useState({
    name: "",
    service_type: "",
  });

  const [vendorError, setVendorError] = useState<string>("");

  const refreshAll = () => {
    invalidateCache("/api/paperless/documents");
    invalidateCache("/api/tasks");
    invalidateCache("/api/categories");
    setRefreshTrigger((t) => t + 1);
  };

  const {
    matchingDoc,
    setMatchingDoc,
    selectedSeriesId,
    setSelectedSeriesId,
    selectedSeriesTitle,
    setSelectedSeriesTitle,
    selectedTaskId,
    setSelectedTaskId,
    createAsOccurrence,
    setCreateAsOccurrence,
    occurrenceDate,
    setOccurrenceDate,
    confirmedDate,
    setConfirmedDate,
    newTaskForm,
    setNewTaskForm,
    successInfo,
    setSuccessInfo,
    pendingSmartAction,
    setPendingSmartAction,
    handleManualMatch,
    handleManualMatchAndComplete,
    handleSmartAction: hookHandleSmartAction,
    confirmSmartAction,
    handleCreateAndMatch,
  } = useDocumentMatching({
    tasks,
    vendors,
    onSuccess: refreshAll,
  });

  const handleSmartAction = (doc: Document, action: SmartAction) => {
    hookHandleSmartAction(doc, {
      type: action.type,
      taskId: action.taskId,
      taskTitle: action.taskTitle,
    });
  };

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
    if (sortedTypes.length > 0) {
      if (!selectedTab || !sortedTypes.includes(selectedTab)) {
        setSelectedTab(sortedTypes[0]);
      }
    } else if (selectedTab) {
      setSelectedTab("");
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
          <div className="flex flex-col items-end gap-3">
            <a
              href={process.env.NEXT_PUBLIC_DOCUMENT_DOMAIN || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="relative z-10 text-sm px-3 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-1 cursor-pointer"
            >
              All documents ↗
            </a>
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

            {selectedTab && groupedByType[selectedTab] && (
              <div>
                <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-lg overflow-hidden shadow-sm">
                  <ul className="divide-y divide-gray-50 dark:divide-gray-800">
                    {[...groupedByType[selectedTab]]
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
                                        : <>Match & Complete {action.taskTitle} on <strong>{format(parseISO(action.dateLabel), "MMMM d yyyy")}</strong></>}
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
        <MatchDocumentErrorBoundary doc={matchingDoc}>
          <MatchDocumentModal
            doc={matchingDoc}
            tasks={tasks}
            vendors={vendors}
            categories={categories}
            selectedSeriesId={selectedSeriesId}
            setSelectedSeriesId={setSelectedSeriesId}
            selectedSeriesTitle={selectedSeriesTitle}
            setSelectedSeriesTitle={setSelectedSeriesTitle}
            selectedTaskId={selectedTaskId}
            setSelectedTaskId={setSelectedTaskId}
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
            onCreateAndMatchComplete={() => handleCreateAndMatch(true)}
            onClose={() => setMatchingDoc(null)}
            isCreatingVendor={isCreatingVendor}
            setIsCreatingVendor={setIsCreatingVendor}
            newVendorForm={newVendorForm}
            setNewVendorForm={setNewVendorForm}
            onCreateVendor={handleCreateVendor}
            vendorError={vendorError}
          />
        </MatchDocumentErrorBoundary>
      )}

      {pendingSmartAction && (
        <SmartActionConfirmModal
          doc={pendingSmartAction.doc}
          task={tasks.find((t) => t.id === pendingSmartAction.taskId)}
          confirmDate={pendingSmartAction.confirmDate}
          onConfirmDateChange={(date) =>
            setPendingSmartAction({ ...pendingSmartAction, confirmDate: date })
          }
          onConfirm={confirmSmartAction}
          onCancel={() => setPendingSmartAction(null)}
        />
      )}

      {successInfo && (
        <MatchSuccessModal
          title={successInfo.title}
          docUrl={successInfo.docUrl}
          taskId={successInfo.taskId}
          onClose={() => setSuccessInfo(null)}
        />
      )}
    </>
  );
}
