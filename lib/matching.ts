import { Task, DocumentRef } from "./tasks";
import { Vendor } from "./vendors";
import { PaperlessDocument, PaperlessCorrespondent } from "./paperless";
import {
  parseISO,
  differenceInDays,
  startOfDay,
  addDays,
  subDays,
  isWithinInterval,
} from "date-fns";

export interface MatchResult {
  linked: DocumentRef[];
  suggestions: DocumentRef[];
}

export function matchDocumentsToCompletion(
  task: Task,
  vendor: Vendor,
  candidates: PaperlessDocument[],
  correspondents: PaperlessCorrespondent[],
  getDocumentUrl: (id: number) => string,
  getTypeLabel: (id: number | null) => string | null
): MatchResult {
  if (!task.last_completed_date) {
    return { linked: [], suggestions: [] };
  }

  const completionDate = startOfDay(parseISO(task.last_completed_date));
  const windowStart = subDays(completionDate, 14);
  const windowEnd = addDays(completionDate, 14);

  // Determine target correspondent ID
  let targetCorrespondentId: number | null = vendor.paperless_correspondent_id ?? null;

  if (targetCorrespondentId === null) {
    // Text-match fallback
    const matches = correspondents.filter((c) => {
      const name = c.name.toLowerCase();
      const vName = vendor.name.toLowerCase();
      const vEmail = vendor.email?.toLowerCase();

      if (vEmail && name === vEmail) return true;
      if (vEmail && vEmail.includes("@") && name === vEmail.split("@")[0]) return true;
      if (name.includes(vName) || vName.includes(name)) return true;
      return false;
    });

    if (matches.length === 1) {
      targetCorrespondentId = matches[0].id;
    }
  }

  if (targetCorrespondentId === null) {
    return { linked: [], suggestions: [] };
  }

  // Filter candidates by correspondent and date window
  const potentialMatches = candidates.filter((doc) => {
    if (doc.correspondent !== targetCorrespondentId) return false;
    const docDate = startOfDay(parseISO(doc.created));
    return isWithinInterval(docDate, { start: windowStart, end: windowEnd });
  });

  // If exactly one match, auto-link. If multiple, suggest all.
  if (potentialMatches.length === 1) {
    const doc = potentialMatches[0];
    const ref: DocumentRef = {
      id: doc.id,
      title: doc.title,
      document_type_id: doc.document_type,
      document_type_label: getTypeLabel(doc.document_type),
      created: doc.created.split("T")[0],
      url: getDocumentUrl(doc.id),
      auto_linked: true,
      linked_at: new Date().toISOString(),
    };
    return { linked: [ref], suggestions: [] };
  } else if (potentialMatches.length > 1) {
    const suggestions = potentialMatches.map((doc) => ({
      id: doc.id,
      title: doc.title,
      document_type_id: doc.document_type,
      document_type_label: getTypeLabel(doc.document_type),
      created: doc.created.split("T")[0],
      url: getDocumentUrl(doc.id),
      auto_linked: false,
      linked_at: new Date().toISOString(),
    }));
    return { linked: [], suggestions };
  }

  return { linked: [], suggestions: [] };
}
