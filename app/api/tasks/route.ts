import { NextResponse } from "next/server";
import { readTasks, writeTasks, type Task, extrapolateFutureTasks, pushFutureTasks } from "@/lib/tasks";

export async function GET() {
  return NextResponse.json(readTasks());
}

export async function POST(req: Request) {
  const body = await req.json();
  const tasks = readTasks();

  const task: Task = {
    id: crypto.randomUUID(),
    series_id: body.series_id ?? crypto.randomUUID(),
    title: body.title,
    description: body.description ?? "",
    frequency: body.frequency,
    status: body.status ?? "Scheduled",
    start_date: body.start_date,
    last_completed_date: body.last_completed_date ?? null,
    estimated_cost: body.estimated_cost ? Number(body.estimated_cost) : null,
    vendor_id: body.vendor_id || null,
    category: body.category,
  };

  tasks.push(task);

  if (!body.no_extrapolate) {
    pushFutureTasks(tasks, extrapolateFutureTasks(task));
  }

  writeTasks(tasks);
  return NextResponse.json(task, { status: 201 });
}
