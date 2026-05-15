import { NextResponse } from "next/server";
import { readVendors } from "@/lib/vendors";
import {
  listDocumentsForCorrespondent,
  listTags,
  listDocumentTypes,
  getDocumentUrl,
} from "@/lib/paperless";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const vendors = readVendors();
    const vendor = vendors.find((v) => v.id === id);

    if (!vendor) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }

    if (!vendor.paperless_correspondent_id) {
      return NextResponse.json([]);
    }

    const [documents, tags, docTypes] = await Promise.all([
      listDocumentsForCorrespondent(vendor.paperless_correspondent_id),
      listTags(),
      listDocumentTypes(),
    ]);

    const tagMap = new Map(tags.map((t) => [t.id, t.name]));
    const typeMap = new Map(docTypes.map((t) => [t.id, t.name]));

    const augmentedDocs = documents.map((doc) => ({
      ...doc,
      tag_names: doc.tags.map((id) => tagMap.get(id) || "Unknown"),
      document_type_label: doc.document_type ? typeMap.get(doc.document_type) : null,
      url: getDocumentUrl(doc.id),
    }));

    return NextResponse.json(augmentedDocs);
  } catch (error: any) {
    console.error("Paperless API error:", error);
    return NextResponse.json(
      { error: "Paperless-ngx unreachable" },
      { status: 502 }
    );
  }
}
