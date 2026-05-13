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
    frequency: body.frequency ?? tasks[idx].frequency,
    due_date: body.due_date ?? tasks[idx].due_date,
    estimated_cost: body.estimated_cost != null ? Number(body.estimated_cost) : null,
    vendor_id: body.vendor_id ?? null,
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
