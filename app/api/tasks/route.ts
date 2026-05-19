import { NextResponse } from "next/server";
import { readTasks, writeTasks, type Task, extrapolateFutureTasks, pushFutureTasks } from "@/lib/tasks";

export async function GET() {
  return NextResponse.json(readTasks());
}

export async function POST(req: Request) {
  const body = await req.json();
  const tasks = readTasks();

  if (!body.line_item_id) {
    return NextResponse.json(
      { error: "line_item_id is required" },
      { status: 400 },
    );
  }

  const task: Task = {
    id: `${body.line_item_id}-${body.start_date}`,
    line_item_id: body.line_item_id,
    title: body.title ?? null,
    description: body.description ?? null,
    frequency: body.frequency ?? null,
    status: body.status ?? "Scheduled",
    start_date: body.start_date,
    last_completed_date: body.last_completed_date ?? null,
    estimated_cost: body.estimated_cost ? Number(body.estimated_cost) : null,
    actual_cost: body.actual_cost != null
      ? Number(body.actual_cost)
      : body.status === "Completed"
        ? (body.estimated_cost ? Number(body.estimated_cost) : null)
        : null,
    vendor_id: body.vendor_id ?? null,
    documents: [],
  };

  const alreadyExists = tasks.some(
    (t) => t.line_item_id === task.line_item_id && t.start_date === task.start_date,
  );
  if (!alreadyExists) {
    tasks.push(task);
  }

  if (!body.no_extrapolate && task.frequency) {
    pushFutureTasks(tasks, extrapolateFutureTasks(task));
  }

  writeTasks(tasks);
  return NextResponse.json(task, { status: 201 });
}
