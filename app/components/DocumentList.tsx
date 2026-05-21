"use client";

import { format, parseISO } from "date-fns";
import { badgeColour } from "@/lib/badge-colour";

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

interface DocumentListProps {
  documents: Document[];
  unlinkedOnly: boolean;
  godMode: boolean;
  onMatch: (doc: Document) => void;
  onSmartAction: (doc: Document, action: SmartAction) => void;
  onUndoDismiss: (docId: number) => void;
  onEditLinks?: (doc: Document) => void;
  selectedTab?: string;
  onTabChange?: (type: string) => void;
}

export default function DocumentList({
  documents,
  unlinkedOnly,
  godMode,
  onMatch,
  onSmartAction,
  onUndoDismiss,
  onEditLinks,
  selectedTab = "",
  onTabChange,
}: DocumentListProps) {
  // ── Document Processing ──
  // Filter documents, group by type, and calculate stats.
  // statsByType loops all documents (not just filtered) to show overall match stats in tabs.
  const filteredDocs = unlinkedOnly
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

  if (filteredDocs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-500 border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-lg">
        <p>No {unlinkedOnly ? "unlinked" : ""} documents found.</p>
      </div>
    );
  }

  // ── Render ──
  return (
    <div>
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-800 mb-8 overflow-x-auto">
        {sortedTypes.map((type) => (
          <button
            key={type}
            onClick={() => onTabChange?.(type)}
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

      {sortedTypes.length > 0 && selectedTab && groupedByType[selectedTab] && (
        <div>
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-lg overflow-hidden shadow-sm">
            <ul className="divide-y divide-gray-50 dark:divide-gray-800">
              {[...groupedByType[selectedTab]]
                // Sort descending by created date (newest first)
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
                            doc.document_type_label
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
                                onClick={() => onSmartAction(doc, action)}
                                className="text-[10px] px-2 py-1 bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-900 rounded hover:bg-amber-100 dark:hover:bg-amber-900 transition-colors"
                              >
                                {action.type === "MATCH_COMPLETED"
                                  ? `Match to ${format(
                                      parseISO(action.dateLabel),
                                      "MMM d"
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
                      {godMode && !doc.is_dismissed && doc.document_type_label?.toLowerCase() === "bill" && !doc.is_matched && (
                        <button
                          onClick={() => onMatch(doc)}
                          className="text-xs text-blue-600 dark:text-blue-400 hover:underline px-2 py-1"
                        >
                          Match
                        </button>
                      )}
                      {doc.is_dismissed ? (
                        <button
                          onClick={() => onUndoDismiss(doc.id)}
                          className="text-xs text-rose-600 dark:text-rose-400 hover:underline px-2 py-1"
                        >
                          Undo Dismiss
                        </button>
                      ) : (
                        onEditLinks && (
                          <button
                            onClick={() => onEditLinks(doc)}
                            className={`text-xs hover:underline px-2 py-1 transition-colors ${
                              doc.is_matched
                                ? "text-gray-500 dark:text-gray-400"
                                : "text-blue-600 dark:text-blue-400"
                            }`}
                            title="Edit links"
                            aria-label="Edit links"
                          >
                            Edit links
                          </button>
                        )
                      )}
                    </div>
                  </li>
                ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
