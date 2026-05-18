"use client";

import { useState } from "react";
import Link from "next/link";
import { useCachedData, invalidateCache } from "@/lib/data";
import { useDocumentMatching } from "@/app/components/matching/useDocumentMatching";
import { MatchDocumentModal } from "@/app/components/matching/MatchDocumentModal";
import { useGodMode } from "@/app/contexts/god-mode";
import BinWeekIndicator from "@/app/components/BinWeekIndicator";
import type { Task } from "@/lib/tasks";
import type { BinColor } from "@/lib/bin-weeks";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface Vendor {
  id: string;
  name: string;
  service_type: string;
}

interface Document {
  id: number;
  title: string;
  created?: string;
  is_matched: boolean;
  is_dismissed: boolean;
  url: string;
  document_type_label: string | null;
  correspondent: number | null;
  tag_names: string[];
  document_type_id: number | null;
  smart_actions: Array<{
    type: "MATCH_COMPLETED" | "COMPLETE_SCHEDULED";
    taskId: string;
    taskTitle: string;
    dateLabel: string;
    confidence: number;
  }>;
}

export default function Home() {
  // ── Data fetching ──
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const { godMode } = useGodMode();

  const { data: tasksData } = useCachedData("/api/tasks", refreshTrigger);
  const { data: vendorsData } = useCachedData("/api/vendors", refreshTrigger);
  const { data: documentsData } = useCachedData("/api/paperless/documents", refreshTrigger);
  const { data: binWeeksData } = useCachedData("/api/bin-weeks", refreshTrigger);

  const tasks: Task[] = Array.isArray(tasksData) ? tasksData : [];
  const vendors: Vendor[] = Array.isArray(vendorsData) ? vendorsData : [];
  const documents: Document[] = Array.isArray(documentsData) ? documentsData : [];
  const binWeeks = (binWeeksData as { coming_up: BinColor[]; following_week: BinColor[]; rotation_day_of_week: number } | null) ?? { coming_up: ["green", "yellow"], following_week: ["black"], rotation_day_of_week: 2 };

  const handleRefresh = () => {
    invalidateCache("/api/paperless/documents");
    invalidateCache("/api/tasks");
    setRefreshTrigger((t) => t + 1);
  };

  const { data: categoriesData } = useCachedData("/api/categories", refreshTrigger);
  const categories: string[] = Array.isArray(categoriesData)
    ? (categoriesData as { name: string }[]).map((c) => c.name)
    : [];

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
    handleManualMatch,
    handleManualMatchAndComplete,
    handleCreateAndMatch,
  } = useDocumentMatching({
    tasks,
    vendors,
    onSuccess: handleRefresh,
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Calculate current bin week based on rotation day of week
  const dayOfWeek = today.getDay();
  const rotationDay = binWeeks.rotation_day_of_week;
  const daysFromRotationDay = dayOfWeek >= rotationDay ? dayOfWeek - rotationDay : dayOfWeek + 7 - rotationDay;
  const weekStartDate = new Date(today);
  weekStartDate.setDate(weekStartDate.getDate() - daysFromRotationDay);

  const yearStart = new Date(today.getFullYear(), 0, 1);
  yearStart.setHours(0, 0, 0, 0);
  const weeksPassed = Math.floor((weekStartDate.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24 * 7));
  const currentBins: BinColor[] = weeksPassed % 2 === 0 ? binWeeks.coming_up : binWeeks.following_week;

  const sixtyDaysFromNow = new Date(today);
  sixtyDaysFromNow.setDate(sixtyDaysFromNow.getDate() + 60);

  const overdue = tasks.filter((t) => {
    if (t.archived || t.task_type === "budget_item") return false;
    return t.status === "Overdue";
  })
    .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());

  const newBills = documents.filter((d) => !d.is_matched && !d.is_dismissed && d.document_type_label?.toLowerCase() === "bill");

  const upcoming = tasks.filter((t) => {
    if (t.archived || t.task_type === "budget_item" || t.status === "Completed" || t.status === "Overdue") return false;
    const startDate = new Date(t.start_date);
    startDate.setHours(0, 0, 0, 0);
    return startDate >= today && startDate <= sixtyDaysFromNow;
  })
    .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
    .slice(0, 10);

  // ── Computed values & utilities ––
  const vendorMap = vendors.reduce((acc: Record<string, string>, v) => {
    acc[v.id] = v.name;
    return acc;
  }, {});

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  };

  const daysOverdue = (startDate: string) => {
    const d = new Date(startDate);
    d.setHours(0, 0, 0, 0);
    const diff = Math.floor((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const docCreatedDate = (docDateStr?: string) => {
    if (!docDateStr) return "—";
    const d = new Date(docDateStr);
    return `${d.getDate() < 10 ? "0" : ""}${d.getDate()} ${MONTHS[d.getMonth()]}`;
  };

  return (
    <main className="animate-page content-container py-10">
      <div className="mb-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold mb-1 text-gray-900 dark:text-gray-100">Home</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">A simple overview</p>
          </div>
          <BinWeekIndicator bins={currentBins} />
        </div>
      </div>

      {/* Overdue tasks: highest priority, only shown if any exist */}
      {overdue.length > 0 && (
        <section className="mb-10">
          <h2 className="flex items-center gap-2 mb-4">
            <span className="inline-block px-2 py-1 bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 text-xs font-semibold rounded">
              OVERDUE
            </span>
          </h2>
          <div className="space-y-2 pl-5">
            {overdue.map((task) => (
              <div key={task.id} className="text-sm">
                <Link href={`/tasks/${task.id}`} className="text-gray-900 dark:text-gray-100 hover:underline">{task.title}</Link>
                {"    "}
                <span className="text-red-600 dark:text-red-400">{daysOverdue(task.start_date)} days overdue</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Unmatched documents: bills needing to be linked to tasks */}
      <section className="mb-10">
        <div className="flex items-center gap-4 mb-4">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 shrink-0">
            New bills
          </h2>
          <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
          <Link href="/documents" className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 shrink-0">
            All bills →
          </Link>
        </div>
        {newBills.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-600 pl-5">All clear</p>
        ) : (
          <div className="space-y-2 pl-5">
            {newBills.map((doc) => (
              <div key={doc.id} className="text-sm">
                <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-gray-900 dark:text-gray-100 hover:underline">{doc.title}</a>
                {"    "}
                <span className="text-gray-500 dark:text-gray-400">{docCreatedDate(doc.created)}</span>
                {godMode && <>{"    "}<button onClick={() => setMatchingDoc(doc)} className="text-blue-600 dark:text-blue-400 hover:underline">Match</button></>}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Upcoming tasks: scheduled items in the next 60 days, limited to 10 for scanability */}
      <section>
        <div className="flex items-center gap-4 mb-4">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 shrink-0">
            Next 60 days
          </h2>
          <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
          <Link href="/tasks" className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 shrink-0">
            All tasks →
          </Link>
        </div>
        {upcoming.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-600 pl-5">All clear</p>
        ) : (
          <div className="space-y-2 pl-5">
            {upcoming.map((task) => (
              <div key={task.id} className="text-sm">
                <span className="text-gray-500 dark:text-gray-500">{formatDate(task.start_date)}</span>
                {"    "}
                <Link href={`/tasks/${task.id}`} className="text-gray-900 dark:text-gray-100 hover:underline">{task.title}</Link>
                {"    "}
                {task.vendor_id && vendorMap[task.vendor_id]
                  ? <span className="text-gray-500 dark:text-gray-400">{vendorMap[task.vendor_id]}</span>
                  : <span className="text-gray-400 dark:text-gray-600">—</span>}
              </div>
            ))}
          </div>
        )}
      </section>

      {matchingDoc && (
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
          onCreateAndMatchComplete={handleCreateAndMatch}
          onClose={() => setMatchingDoc(null)}
        />
      )}
    </main>
  );
}
