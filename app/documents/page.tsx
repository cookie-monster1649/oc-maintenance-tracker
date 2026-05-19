"use client";

import { useState, useEffect } from "react";
import { useCachedData, invalidateCache } from "@/lib/data";
import { useGodMode } from "@/app/contexts/god-mode";
import { useDocumentMatching } from "@/app/components/matching/useDocumentMatching";
import { MatchDocumentModal } from "@/app/components/matching/MatchDocumentModal";
import { MatchDocumentErrorBoundary } from "@/app/components/matching/MatchDocumentErrorBoundary";
import { SmartActionConfirmModal } from "@/app/components/matching/SmartActionConfirmModal";
import { MatchSuccessModal } from "@/app/components/matching/MatchSuccessModal";
import DocumentList from "@/app/components/DocumentList";

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
  line_item_id: string;
  title: string | null;
  description: string | null;
  frequency: string | null;
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

  // ── Data Fetching ──
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [refreshStartTime, setRefreshStartTime] = useState<number | null>(null);
  const [minLoadingTimeReached, setMinLoadingTimeReached] = useState(true);

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
  const { data: vendorsData } = useCachedData(
    "/api/vendors",
    refreshTrigger,
  );

  const documents: Document[] = Array.isArray(documentsData) ? documentsData : [];
  const tasks: Task[] = Array.isArray(tasksData) ? tasksData : [];
  const categories: string[] = Array.isArray(categoriesData)
    ? (categoriesData as { name: string }[]).map((c) => c.name)
    : [];
  const vendors = Array.isArray(vendorsData) ? vendorsData : [];

  // ── UI State ──
  const [unmatchedOnly, setUnmatchedOnly] = useState(true);
  const [isCreatingVendor, setIsCreatingVendor] = useState(false);
  const [selectedTab, setSelectedTab] = useState<string>("");

  const [newVendorForm, setNewVendorForm] = useState({
    name: "",
    service_type: "",
  });

  const [vendorError, setVendorError] = useState<string>("");

  const [documentDomain] = useState<string>(
    () => process.env.NEXT_PUBLIC_DOCUMENT_DOMAIN || "#"
  );

  useEffect(() => {
    if (refreshStartTime === null) return;

    const timer = setTimeout(() => {
      setMinLoadingTimeReached(true);
      setRefreshStartTime(null);
    }, 1000);

    return () => clearTimeout(timer);
  }, [refreshStartTime]);

  // ── Handlers ──
  const refreshAll = () => {
    invalidateCache("/api/paperless/documents");
    invalidateCache("/api/tasks");
    invalidateCache("/api/categories");
    setRefreshStartTime(Date.now());
    setMinLoadingTimeReached(false);
    setRefreshTrigger((t) => t + 1);
  };

  // ── Modal State (from custom hook) ──
  // Manages document matching, smart actions, and success modals.
  const {
    matchingDoc,
    setMatchingDoc,
    selectedSeriesId,
    setSelectedSeriesId,
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
    tasks: tasks,
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

  // ── Document Filtering & Tab State ──
  // Filters documents based on unmatchedOnly setting and manages selected document type tab.
  const filteredDocs = unmatchedOnly
    ? documents.filter((doc) => !doc.is_matched && !doc.is_dismissed)
    : documents;

  // Sync tab selection with available document types.
  // Sets initial tab and ensures selected tab is valid when documents change.
  useEffect(() => {
    const types = Array.from(new Set(filteredDocs.map((doc) => doc.document_type_label || "Uncategorized"))).sort();
    if (types.length > 0) {
      if (!selectedTab || !types.includes(selectedTab)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSelectedTab(types[0]);
      }
    } else if (selectedTab) {
      setSelectedTab("");
    }
  }, [filteredDocs, selectedTab]);

  const isRefreshing =
    (isDocsRefreshing || isTasksRefreshing || isCatsRefreshing);

  const isButtonLoading = refreshStartTime !== null && !minLoadingTimeReached;

  // ── Render ──
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
              All stored documents
            </p>
          </div>
          <div className="flex flex-col items-end gap-3">
            <a
              href={documentDomain}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm px-3 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-1"
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
                disabled={isButtonLoading}
                className="text-sm px-3 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center justify-center w-20 h-9"
              >
                {isButtonLoading ? (
                  <svg className="animate-spin h-4 w-4 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  "Refresh"
                )}
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
        ) : (
          <DocumentList
            documents={filteredDocs}
            unmatchedOnly={unmatchedOnly}
            godMode={godMode}
            selectedTab={selectedTab}
            onTabChange={setSelectedTab}
            onMatch={setMatchingDoc}
            onSmartAction={handleSmartAction}
            onUndoDismiss={async (docId: number) => {
              await fetch(`/api/documents/${docId}/dismiss`, { method: "DELETE" });
              refreshAll();
            }}
          />
        )}
      </main>

      {/* Modals: matchingDoc → MatchDocumentModal, pendingSmartAction → SmartActionConfirmModal, successInfo → MatchSuccessModal */}
      {matchingDoc && (
        <MatchDocumentErrorBoundary doc={matchingDoc}>
          <MatchDocumentModal
            doc={matchingDoc}
            tasks={tasks}
            vendors={vendors}
            categories={categories}
            selectedSeriesId={selectedSeriesId}
            setSelectedSeriesId={setSelectedSeriesId}
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
          lineItemId={successInfo.lineItemId}
          onClose={() => setSuccessInfo(null)}
        />
      )}
    </>
  );
}
