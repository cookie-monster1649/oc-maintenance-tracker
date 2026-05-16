import { NextResponse } from "next/server";
import { readTasks, writeTasks, nextStartDate, extrapolateFutureTasks } from "@/lib/tasks";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
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

  // Create next recurrence — start date advances from previous start_date
  const newTask = {
    ...task,
    id: crypto.randomUUID(),
    status: "Scheduled" as const,
    start_date: nextStartDate(task.start_date, task.frequency),
    last_completed_date: null,
    documents: [],
  };

  tasks.push(newTask);

  // Extrapolate future tasks to ensure multiple occurrences are always scheduled
  const futureTasks = extrapolateFutureTasks(newTask);
  for (const fTask of futureTasks) {
    if (!tasks.find((t) => t.id === fTask.id)) {
      tasks.push(fTask);
    }
  }

  writeTasks(tasks);

  return NextResponse.json({ completed: tasks[idx], next: newTask });
}
