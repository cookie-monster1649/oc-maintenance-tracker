import { NextResponse } from "next/server";
import { readTasks, writeTasks } from "@/lib/tasks";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; docId: string }> },
) {
  try {
    const { id, docId } = await params;
    const tasks = readTasks();
    const taskIndex = tasks.findIndex((t) => t.id === id);
    const task = tasks[taskIndex];

    if (!task || !task.documents) {
      return NextResponse.json(
        { error: "Task or documents not found" },
        { status: 404 },
      );
    }

    task.documents = task.documents.filter((d) => d.id !== parseInt(docId, 10));
    writeTasks(tasks);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete document error:", error);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
