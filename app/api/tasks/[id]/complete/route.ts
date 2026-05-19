import { NextResponse } from "next/server";
import { readTasks, writeTasks, nextStartDate, extrapolateFutureTasks, pushFutureTasks } from "@/lib/tasks";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const tasks = readTasks();
  const idx = tasks.findIndex((t) => t.id === id);

  if (idx === -1) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const task = tasks[idx];
  const today = new Date().toISOString().split("T")[0];

  // Set actual_cost: use provided value or fall back to estimated_cost
  const actualCost = body.actual_cost != null ? Number(body.actual_cost) : task.estimated_cost;

  // Update completed task
  tasks[idx] = {
    ...task,
    status: "Completed",
    last_completed_date: today,
    actual_cost: actualCost,
  };

  // Only generate next tasks if this is a recurring task and the immediate next
  // occurrence in THIS pattern doesn't already exist. Checking the next date
  // (rather than counting all futures) avoids cross-pattern interference when
  // multiple recurring tasks share the same line item.
  let nextTask = undefined;
  if (task.frequency) {
    const nextDate = nextStartDate(task.start_date, task.frequency);

    const nextAlreadyExists = tasks.some(
      (t) => t.line_item_id === task.line_item_id && t.start_date === nextDate,
    );

    const totalScheduled = tasks.filter(
      (t) => t.line_item_id === task.line_item_id && t.status !== "Completed",
    ).length;

    if (!body.no_extrapolate && !nextAlreadyExists && totalScheduled < 3) {
      pushFutureTasks(tasks, extrapolateFutureTasks(task));
    }

    nextTask = tasks.find(
      (t) => t.line_item_id === task.line_item_id && t.start_date === nextDate,
    );
  }

  writeTasks(tasks);

  return NextResponse.json({ completed: tasks[idx], next: nextTask });
}
