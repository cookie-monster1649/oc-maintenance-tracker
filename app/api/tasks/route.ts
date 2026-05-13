import { NextResponse } from "next/server";
import { readTasks, writeTasks, type Task } from "@/lib/tasks";

export async function GET() {
  return NextResponse.json(readTasks());
}

export async function POST(req: Request) {
  const body = await req.json();
  const tasks = readTasks();

  const task: Task = {
    id: crypto.randomUUID(),
    title: body.title,
    description: body.description ?? "",
    frequency: body.frequency,
    status: "Scheduled",
    due_date: body.due_date,
    last_completed_date: null,
    estimated_cost: body.estimated_cost ? Number(body.estimated_cost) : null,
    vendor_id: body.vendor_id || null,
    category: body.category,
  };

  tasks.push(task);
  writeTasks(tasks);
  return NextResponse.json(task, { status: 201 });
}
