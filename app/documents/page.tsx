"use client";

import { useEffect, useState } from "react";
import { badgeColour } from "@/lib/badge-colour";
import { format, parseISO } from "date-fns";

interface Document {
  id: number;
  title: string;
  tag_names: string[];
  document_type_id: number | null;
  document_type_label: string | null;
  created: string;
  url: string;
  is_matched: boolean;
  is_dismissed: boolean;
}

interface Task {
  id: string;
  title: string;
  last_completed_date: string | null;
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unmatchedOnly, setUnmatchedOnly] = useState(true);

  const [matchingDoc, setMatchingDoc] = useState<Document | null>(null);
  const [selectedTaskTitle, setSelectedTaskTitle] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState("");

  async function fetchDocuments() {
    setLoading(true);
    try {
      const [docRes, taskRes] = await Promise.all([
        fetch("/api/paperless/documents"),
        fetch("/api/tasks"),
      ]);

      if (!docRes.ok) {
        const data = await docRes.json();
        throw new Error(data.error || "Failed to fetch documents");
      }

      const docs = await docRes.json();
      const tasksData = await taskRes.json();

      setDocuments(docs);
      setTasks(tasksData);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchDocuments();
  }, []);

  async function handleManualMatch() {
    if (!matchingDoc || !selectedTaskId) return;

    try {
      const res = await fetch(`/api/tasks/${selectedTaskId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document: matchingDoc }),
      });

      if (res.ok) {
        setMatchingDoc(null);
        setSelectedTaskId("");
        setSelectedTaskTitle("");
        fetchDocuments();
      }
    } catch (err) {
      console.error("Manual match failed", err);
    }
  }

  const distinctTaskTitles = Array.from(
    new Set(tasks.map((t) => t.title)),
  ).sort();
  const instancesForSelectedTitle = tasks
    .filter((t) => t.title === selectedTaskTitle)
    .sort((a, b) =>
      (b.last_completed_date || "").localeCompare(a.last_completed_date || ""),
    );

  const filteredDocs = unmatchedOnly
    ? documents.filter((doc) => !doc.is_matched && !doc.is_dismissed)
    : documents;

  // Group by tag (a doc can appear in multiple tag groups)
  const groupedByTag: Record<string, Document[]> = {};
  filteredDocs.forEach((doc) => {
    const tags = doc.tag_names.length > 0 ? doc.tag_names : ["No Tag"];
    tags.forEach((tag) => {
      if (!groupedByTag[tag]) groupedByTag[tag] = [];
      groupedByTag[tag].push(doc);
    });
  });

  const sortedTags = Object.keys(groupedByTag).sort((a, b) => {
    if (a === "No Tag") return 1;
    if (b === "No Tag") return -1;
    return a.localeCompare(b);
  });

  return (
    <>
      <main className="animate-page max-w-6xl mx-auto px-4 py-10">
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
              onClick={fetchDocuments}
              disabled={loading}
              className="text-sm px-3 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-900 rounded-md p-4 mb-8">
            <p className="text-sm text-amber-800 dark:text-amber-400 flex items-center gap-2">
              <span>⚠️</span> {error}
            </p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-500">
            <span className="animate-pulse">Loading documents...</span>
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500 border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-lg">
            <p>No {unmatchedOnly ? "unmatched" : ""} documents found.</p>
          </div>
        ) : (
          <div className="space-y-12">
            {sortedTags.map((tag) => (
              <section key={tag}>
                <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-4 px-1">
                  {tag} ({groupedByTag[tag].length})
                </h2>
                <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-lg overflow-hidden shadow-sm">
                  <ul className="divide-y divide-gray-50 dark:divide-gray-800">
                    {groupedByTag[tag]
                      .sort((a, b) => b.created.localeCompare(a.created))
                      .map((doc) => (
                        <li
                          key={`${tag}-${doc.id}`}
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
                                {format(parseISO(doc.created), "dd MMM yyyy")}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                {doc.title}
                              </h3>
                              <div className="flex gap-1 mt-0.5">
                                {doc.tag_names.map((tn) => (
                                  <span
                                    key={tn}
                                    className="text-[9px] text-gray-400 bg-gray-50 dark:bg-gray-800 px-1 rounded"
                                  >
                                    {tn}
                                  </span>
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
                                  fetchDocuments();
                                }}
                                className="text-xs text-rose-600 dark:text-rose-400 hover:underline px-2 py-1"
                              >
                                Undo Dismiss
                              </button>
                            )}
                            {!doc.is_matched && !doc.is_dismissed && (
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
              </section>
            ))}
          </div>
        )}
      </main>

      {matchingDoc && (
        <div className="animate-backdrop fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="animate-modal bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full p-8">
            <h2 className="text-xl font-bold mb-6 text-gray-900 dark:text-gray-100">
              Match Document
            </h2>
            <div className="space-y-6">
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-md border border-gray-100 dark:border-gray-700">
                <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">
                  Document
                </p>
                <p className="text-sm font-medium truncate">
                  {matchingDoc.title}
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  1. Select Task Series
                </label>
                <select
                  value={selectedTaskTitle}
                  onChange={(e) => {
                    setSelectedTaskTitle(e.target.value);
                    setSelectedTaskId("");
                  }}
                  className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
                >
                  <option value="">Select a task...</option>
                  {distinctTaskTitles.map((title) => (
                    <option key={title} value={title}>
                      {title}
                    </option>
                  ))}
                </select>
              </div>

              {selectedTaskTitle && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    2. Select Specific Completion
                  </label>
                  <select
                    value={selectedTaskId}
                    onChange={(e) => setSelectedTaskId(e.target.value)}
                    className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
                  >
                    <option value="">Select date...</option>
                    {instancesForSelectedTitle.map((task) => (
                      <option key={task.id} value={task.id}>
                        {task.last_completed_date
                          ? format(
                              parseISO(task.last_completed_date),
                              "dd MMM yyyy",
                            )
                          : "Scheduled"}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleManualMatch}
                  disabled={!selectedTaskId}
                  className="flex-1 text-sm px-4 py-2 rounded-md bg-gray-900 dark:bg-gray-700 text-white hover:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-40 transition-colors font-medium"
                >
                  Link Document
                </button>
                <button
                  onClick={() => {
                    setMatchingDoc(null);
                    setSelectedTaskTitle("");
                    setSelectedTaskId("");
                  }}
                  className="flex-1 text-sm px-4 py-2 rounded-md border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
