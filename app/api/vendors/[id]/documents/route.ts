import { NextResponse } from "next/server";
import { readVendors } from "@/lib/vendors";
import { readTasks } from "@/lib/tasks";
import {
  listCorrespondents,
  listDocumentsForCorrespondent,
  listTags,
  listDocumentTypes,
  getDocumentUrl,
  type PaperlessDocument,
  type PaperlessCorrespondent,
} from "@/lib/paperless";
import { getSmartActions, type SmartAction } from "@/lib/recommendations";

interface VendorDocument {
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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const vendors = readVendors();
    const vendor = vendors.find((v) => v.id === id);

    if (!vendor) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }

    const tasks = readTasks();
    const vendorTasks = tasks.filter((t) => t.vendor_id === id);
    const taskDocs = vendorTasks.flatMap((t) => t.documents || []);

    const [tags, docTypes, correspondents] = await Promise.all([
      listTags(),
      listDocumentTypes(),
      listCorrespondents(),
    ]);

    const tagMap = new Map(tags.map((t) => [t.id, t.name]));
    const typeMap = new Map(docTypes.map((t) => [t.id, t.name]));

    // Resolve correspondent: use explicit ID or fuzzy-match on vendor name/email
    let correspondentId: number | null = vendor.paperless_correspondent_id ?? null;
    if (correspondentId === null) {
      const vName = vendor.name.toLowerCase();
      const vEmail = vendor.email?.toLowerCase();
      const match = correspondents.find((c: PaperlessCorrespondent) => {
        const name = c.name.toLowerCase();
        if (vEmail && name === vEmail) return true;
        if (vEmail && vEmail.includes("@") && name === vEmail.split("@")[0]) return true;
        if (name.includes(vName) || vName.includes(name)) return true;
        return false;
      });
      if (match) correspondentId = match.id;
    }

    // Fetch all docs for the resolved correspondent
    let paperlessDocs: PaperlessDocument[] = [];
    if (correspondentId !== null) {
      paperlessDocs = await listDocumentsForCorrespondent(correspondentId);
    }

    // Compute which doc IDs are already linked to any task
    const matchedDocIds = new Set<number>();
    tasks.forEach((task) => {
      (task.documents || []).forEach((doc) => matchedDocIds.add(doc.id));
    });

    const mergedDocs = new Map<number, VendorDocument>();

    // 1. Add Paperless docs with matching metadata
    paperlessDocs.forEach((doc) => {
      mergedDocs.set(doc.id, {
        id: doc.id,
        title: doc.title,
        tag_names: doc.tags.map((tid: number) => tagMap.get(tid) || "Unknown"),
        document_type_label: doc.document_type
          ? typeMap.get(doc.document_type) || null
          : null,
        created: doc.created || "",
        url: getDocumentUrl(doc.id),
        is_matched: matchedDocIds.has(doc.id),
        correspondent: doc.correspondent,
        smart_actions: getSmartActions(doc, tasks, vendors),
      });
    });

    // 2. Add task-linked docs not in correspondent list (always matched)
    taskDocs.forEach((doc) => {
      if (!mergedDocs.has(doc.id)) {
        mergedDocs.set(doc.id, {
          id: doc.id,
          title: doc.title,
          tag_names: [],
          document_type_label: doc.document_type_label,
          created: doc.created,
          url: doc.url,
          is_matched: true,
          correspondent: null,
          smart_actions: [],
        });
      }
    });

    const result = Array.from(mergedDocs.values()).sort((a, b) =>
      (b.created || "").localeCompare(a.created || ""),
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Vendor documents error:", error);
    return NextResponse.json(
      { error: "Failed to fetch vendor documents" },
      { status: 500 },
    );
  }
}
