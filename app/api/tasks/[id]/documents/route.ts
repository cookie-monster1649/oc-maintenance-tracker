import { NextResponse } from "next/server";
import { readTasks, writeTasks, DocumentRef } from "@/lib/tasks";
import { getDocumentUrl, listDocumentTypes } from "@/lib/paperless";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { document } = await request.json(); // Full document object from Paperless

    const tasks = readTasks();
    const taskIndex = tasks.findIndex((t) => t.id === id);
    const task = tasks[taskIndex];

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
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
      created: document.created.split("T")[0],
      url: getDocumentUrl(document.id),
      auto_linked: false,
      linked_at: new Date().toISOString(),
    };

    task.documents = [...(task.documents || []), ref];
    writeTasks(tasks);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Manual match error:", error);
    return NextResponse.json({ error: "Match failed" }, { status: 500 });
  }
}
