import { NextResponse } from "next/server";
import { readTasks, writeTasks } from "@/lib/tasks";

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const tasks = readTasks();
  const idx = tasks.findIndex((t) => t.id === id);

  if (idx === -1) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  tasks[idx] = {
    ...tasks[idx],
    title: body.title ?? tasks[idx].title,
    description: body.description ?? tasks[idx].description,
    task_type: body.task_type ?? tasks[idx].task_type,
    frequency: body.frequency ?? tasks[idx].frequency,
    variable_cost: body.variable_cost ?? tasks[idx].variable_cost,
    start_date: body.start_date ?? tasks[idx].start_date,
    estimated_cost: body.estimated_cost != null ? Number(body.estimated_cost) : tasks[idx].estimated_cost,
    actual_cost: body.actual_cost != null ? Number(body.actual_cost) : tasks[idx].actual_cost,
    vendor_id: body.vendor_id ?? tasks[idx].vendor_id,
    category: body.category ?? tasks[idx].category,
    archived: body.archived ?? tasks[idx].archived,
  };

  writeTasks(tasks);
  return NextResponse.json(tasks[idx]);
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const tasks = readTasks();
  const filtered = tasks.filter((t) => t.id !== id);

  if (filtered.length === tasks.length) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  writeTasks(filtered);
  return new Response(null, { status: 204 });
}
