import { NextResponse } from "next/server";
import { readLineItems, writeLineItems } from "@/lib/line-items";
import { readTasks, writeTasks } from "@/lib/tasks";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const lineItems = readLineItems();
  const lineItem = lineItems.find((li) => li.id === id);

  if (!lineItem) {
    return NextResponse.json({ error: "Line item not found" }, { status: 404 });
  }

  return NextResponse.json(lineItem);
}

export async function PUT(req: Request, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const lineItems = readLineItems();
  const idx = lineItems.findIndex((li) => li.id === id);

  if (idx === -1) {
    return NextResponse.json({ error: "Line item not found" }, { status: 404 });
  }

  lineItems[idx] = {
    ...lineItems[idx],
    title: body.title ?? lineItems[idx].title,
    description: body.description ?? lineItems[idx].description,
    category: body.category ?? lineItems[idx].category,
    vendor_id: body.vendor_id ?? lineItems[idx].vendor_id,
    ocy_entries: body.ocy_entries ?? lineItems[idx].ocy_entries,
    archived: body.archived ?? lineItems[idx].archived,
  };

  writeLineItems(lineItems);
  return NextResponse.json(lineItems[idx]);
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const lineItems = readLineItems();
  const idx = lineItems.findIndex((li) => li.id === id);

  if (idx === -1) {
    return NextResponse.json({ error: "Line item not found" }, { status: 404 });
  }

  // Soft delete: mark as archived and archive all associated tasks
  lineItems[idx].archived = true;
  const tasks = readTasks();
  const updatedTasks = tasks.map((t) =>
    t.line_item_id === id ? { ...t, archived: true } : t,
  );

  writeLineItems(lineItems);
  writeTasks(updatedTasks);
  return new Response(null, { status: 204 });
}
