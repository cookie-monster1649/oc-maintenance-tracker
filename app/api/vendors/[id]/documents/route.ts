import { NextResponse } from "next/server";
import { readVendors } from "@/lib/vendors";
import { readTasks } from "@/lib/tasks";
import {
  listDocumentsForCorrespondent,
  listTags,
  listDocumentTypes,
  getDocumentUrl,
  type PaperlessDocument,
} from "@/lib/paperless";

interface VendorDocument {
  id: number;
  title: string;
  tag_names: string[];
  document_type_label: string | null;
  created?: string;
  url: string;
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

    const [tags, docTypes] = await Promise.all([
      listTags(),
      listDocumentTypes(),
    ]);

    const tagMap = new Map(tags.map((t) => [t.id, t.name]));
    const typeMap = new Map(docTypes.map((t) => [t.id, t.name]));

    // Fetch correspondent docs if linked
    let paperlessDocs: PaperlessDocument[] = [];
    if (vendor.paperless_correspondent_id) {
      paperlessDocs = await listDocumentsForCorrespondent(
        vendor.paperless_correspondent_id,
      );
    }

    // Use a map to deduplicate and merge metadata
    const mergedDocs = new Map<number, VendorDocument>();

    // 1. Add Paperless docs (they have tags)
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
      });
    });

    // 2. Add task docs (ensure they are present even if not in correspondent list)
    taskDocs.forEach((doc) => {
      if (!mergedDocs.has(doc.id)) {
        mergedDocs.set(doc.id, {
          id: doc.id,
          title: doc.title,
          tag_names: [], // We don't have tags in DocumentRef
          document_type_label: doc.document_type_label,
          created: doc.created,
          url: doc.url,
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
