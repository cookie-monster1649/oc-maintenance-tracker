import { NextResponse } from "next/server";
import { readTasks, writeTasks, nextDueDate } from "@/lib/tasks";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const tasks = readTasks();
  const idx = tasks.findIndex((t) => t.id === id);

  if (idx === -1) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const task = tasks[idx];
  const today = new Date().toISOString().split("T")[0];

  // Update completed task
  tasks[idx] = {
    ...task,
    status: "Completed",
    last_completed_date: today,
  };

  // Create next recurrence — due date advances from previous due_date, not today
  const newTask = {
    ...task,
    id: crypto.randomUUID(),
    status: "Scheduled" as const,
    due_date: nextDueDate(task.due_date, task.frequency),
    last_completed_date: null,
  };

  tasks.push(newTask);
  writeTasks(tasks);

  return NextResponse.json({ completed: tasks[idx], next: newTask });
}
