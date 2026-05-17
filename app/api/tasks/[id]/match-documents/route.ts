import { NextResponse } from "next/server";
import { readTasks, writeTasks, extrapolateFutureTasks, pushFutureTasks, nextStartDate } from "@/lib/tasks";
import { readVendors } from "@/lib/vendors";
import {
  listAllDocuments,
  listCorrespondents,
  listDocumentTypes,
  getDocumentUrl,
} from "@/lib/paperless";
import { matchDocumentsToCompletion } from "@/lib/matching";
import { parseISO, startOfDay, isBefore } from "date-fns";

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
      const today = startOfDay(new Date());
      const taskDate = parseISO(task.start_date);
      const isPastDate = isBefore(taskDate, today);

      if (isPastDate) {
        // Mark as completed and link documents
        task.status = "Completed";
        task.last_completed_date = task.start_date;
        task.documents = [...(task.documents || []), ...result.linked];

        // Extrapolate 3 future occurrences from the completed task (starting at next date)
        pushFutureTasks(tasks, extrapolateFutureTasks(task));
      } else {
        // Current task is in future, link documents and extrapolate
        task.documents = [...(task.documents || []), ...result.linked];
        pushFutureTasks(tasks, extrapolateFutureTasks(task));
      }

      writeTasks(tasks);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Match error:", error);
    return NextResponse.json({ error: "Matching failed" }, { status: 502 });
  }
}
