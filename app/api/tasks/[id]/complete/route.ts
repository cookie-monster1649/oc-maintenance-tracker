import { NextResponse } from "next/server";
import { readTasks, writeTasks, nextStartDate, extrapolateFutureTasks, pushFutureTasks } from "@/lib/tasks";

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

  const nextDate = nextStartDate(task.start_date, task.frequency);

  // Extrapolate 3 future occurrences from the completed task (starting at nextDate)
  pushFutureTasks(tasks, extrapolateFutureTasks(task));

  writeTasks(tasks);

  const nextTask = tasks.find(
    (t) => t.series_id === task.series_id && t.start_date === nextDate,
  );

  return NextResponse.json({ completed: tasks[idx], next: nextTask });
}
