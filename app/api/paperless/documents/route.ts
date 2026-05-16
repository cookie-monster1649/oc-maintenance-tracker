import { NextResponse } from "next/server";
import {
  listAllDocuments,
  listTags,
  listDocumentTypes,
  getDocumentUrl,
} from "@/lib/paperless";
import { readTasks } from "@/lib/tasks";
import { readVendors } from "@/lib/vendors";
import { readDismissed } from "@/lib/dismissed";
import { getSmartActions } from "@/lib/recommendations";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [documents, tags, docTypes, tasks, vendors, dismissed] =
      await Promise.all([
        listAllDocuments(),
        listTags(),
        listDocumentTypes(),
        readTasks(),
        readVendors(),
        readDismissed(),
      ]);

    // Simple matched check: see if doc ID exists in any task's documents array
    const matchedDocIds = new Set<number>();
    tasks.forEach((task) => {
      if (task.documents) {
        task.documents.forEach((doc) => matchedDocIds.add(doc.id));
      }
    });

    const dismissedIds = new Set(dismissed.map((d) => d.id));

    // Augment documents with metadata
    const tagMap = new Map(tags.map((t) => [t.id, t.name]));
    const typeMap = new Map(docTypes.map((t) => [t.id, t.name]));

    const augmentedDocs = documents.map((doc) => ({
      ...doc,
      tag_names: doc.tags.map((id) => tagMap.get(id) || "Unknown"),
      document_type_label: doc.document_type
        ? typeMap.get(doc.document_type)
        : null,
      url: getDocumentUrl(doc.id),
      is_matched: matchedDocIds.has(doc.id),
      is_dismissed: dismissedIds.has(doc.id),
      smart_actions: getSmartActions(doc, tasks, vendors),
    }));

    return NextResponse.json(augmentedDocs);
  } catch (error) {
    console.error("Paperless API error:", error);
    return NextResponse.json(
      { error: "Paperless-ngx unreachable or misconfigured" },
      { status: 502 },
    );
  }
}
