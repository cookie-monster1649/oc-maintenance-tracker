import { NextResponse } from "next/server";
import { readLineItems, writeLineItems } from "@/lib/line-items";
import { getDocumentUrl, listDocumentTypes } from "@/lib/paperless";
import type { DocumentRef } from "@/lib/tasks";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { document } = await request.json();

    const lineItems = readLineItems();
    const idx = lineItems.findIndex((li) => li.id === id);

    if (idx === -1) {
      return NextResponse.json({ error: "Line item not found" }, { status: 404 });
    }

    const docTypes = await listDocumentTypes();
    const typeMap = new Map(docTypes.map((t) => [t.id, t.name]));

    const ref: DocumentRef = {
      id: document.id,
      title: document.title,
      document_type_id: document.document_type,
      document_type_label: document.document_type
        ? typeMap.get(document.document_type) || null
        : null,
      created: document.created ? document.created.split("T")[0] : "",
      url: getDocumentUrl(document.id),
      auto_linked: false,
      linked_at: new Date().toISOString(),
    };

    lineItems[idx].documents = [...(lineItems[idx].documents || []), ref];
    writeLineItems(lineItems);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Line item document link error:", error);
    return NextResponse.json({ error: "Link failed" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const docId = Number(searchParams.get("docId"));

    const lineItems = readLineItems();
    const idx = lineItems.findIndex((li) => li.id === id);

    if (idx === -1) {
      return NextResponse.json({ error: "Line item not found" }, { status: 404 });
    }

    lineItems[idx].documents = (lineItems[idx].documents || []).filter((d) => d.id !== docId);
    writeLineItems(lineItems);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Line item document unlink error:", error);
    return NextResponse.json({ error: "Unlink failed" }, { status: 500 });
  }
}
