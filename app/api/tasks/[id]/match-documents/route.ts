import { NextResponse } from "next/server";
import { readTasks, writeTasks, extrapolateFutureTasks } from "@/lib/tasks";
import { readVendors } from "@/lib/vendors";
import {
  listAllDocuments,
  listCorrespondents,
  listDocumentTypes,
  getDocumentUrl,
} from "@/lib/paperless";
import { matchDocumentsToCompletion } from "@/lib/matching";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const tasks = readTasks();
    const taskIndex = tasks.findIndex((t) => t.id === id);
    const task = tasks[taskIndex];

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    if (!task.last_completed_date) {
      return NextResponse.json({ linked: [], suggestions: [] });
    }

    const vendors = readVendors();
    const vendor = vendors.find((v) => v.id === task.vendor_id);

    if (!vendor) {
      return NextResponse.json({ linked: [], suggestions: [] });
    }

    // Fetch context from Paperless
    const [documents, correspondents, docTypes] = await Promise.all([
      listAllDocuments(),
      listCorrespondents(),
      listDocumentTypes(),
    ]);

    const typeMap = new Map(docTypes.map((t) => [t.id, t.name]));
    const result = matchDocumentsToCompletion(
      task,
      vendor,
      documents,
      correspondents,
      getDocumentUrl,
      (typeId) => (typeId ? typeMap.get(typeId) || null : null),
    );

    // Filter out already linked documents
    const existingIds = new Set(task.documents?.map((d) => d.id) || []);
    result.linked = result.linked.filter((d) => !existingIds.has(d.id));
    result.suggestions = result.suggestions.filter(
      (d) => !existingIds.has(d.id),
    );

    if (result.linked.length > 0) {
      task.documents = [...(task.documents || []), ...result.linked];

      // Extrapolate recurring tasks if not already present
      const futureTasks = extrapolateFutureTasks(task);
      for (const fTask of futureTasks) {
        if (!tasks.find((t) => t.id === fTask.id)) {
          tasks.push(fTask);
        }
      }

      writeTasks(tasks);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Match error:", error);
    return NextResponse.json({ error: "Matching failed" }, { status: 502 });
  }
}
