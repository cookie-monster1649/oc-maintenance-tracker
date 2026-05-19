import { NextResponse } from "next/server";
import { readTasks, writeTasks, nextStartDate } from "@/lib/tasks";
import { parseISO, isBefore } from "date-fns";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { new_date } = await request.json();

  if (!new_date) {
    return NextResponse.json({ error: "new_date required" }, { status: 400 });
  }

  const tasks = readTasks();
  const idx = tasks.findIndex((t) => t.id === id);

  if (idx === -1) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const task = tasks[idx];
  const oldDate = task.start_date;

  tasks[idx] = { ...task, start_date: new_date };

  // Ripple through future scheduled tasks in the series, re-sequencing dates
  const futureScheduled = tasks
    .filter(
      (t) =>
        t.line_item_id === task.line_item_id &&
        t.id !== id &&
        t.status !== "Completed" &&
        isBefore(parseISO(oldDate), parseISO(t.start_date)),
    )
    .sort((a, b) => a.start_date.localeCompare(b.start_date));

  let anchor = new_date;
  for (const ft of futureScheduled) {
    const ftIdx = tasks.findIndex((t) => t.id === ft.id);
    anchor = nextStartDate(anchor, task.frequency);
    tasks[ftIdx] = { ...tasks[ftIdx], start_date: anchor, status: "Scheduled" };
  }

  writeTasks(tasks);
  return NextResponse.json({ updated: tasks[idx] });
}
