import { NextResponse } from "next/server";
import { readTasks, writeTasks } from "@/lib/tasks";
import { readVendors, writeVendors } from "@/lib/vendors";
import { readExpenses, writeExpenses } from "@/lib/expenses";
import { readCategories, writeCategories, readCategoryColors, writeCategoryColors } from "@/lib/categoryColors";

export async function GET() {
  const bundle = {
    version: 1,
    exportedAt: new Date().toISOString(),
    tasks: readTasks(),
    vendors: readVendors(),
    expenses: readExpenses(),
    categories: readCategories(),
    categoryColors: readCategoryColors(),
  };
  return NextResponse.json(bundle);
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }

  const data = body as Record<string, unknown>;

  if (!Array.isArray(data.tasks) || !Array.isArray(data.vendors) || !Array.isArray(data.expenses) || !Array.isArray(data.categories)) {
    return NextResponse.json({ error: "Missing required fields: tasks, vendors, expenses, categories" }, { status: 400 });
  }

  writeTasks(data.tasks as Parameters<typeof writeTasks>[0]);
  writeVendors(data.vendors as Parameters<typeof writeVendors>[0]);
  writeExpenses(data.expenses as Parameters<typeof writeExpenses>[0]);
  writeCategories(data.categories as string[]);
  if (data.categoryColors && typeof data.categoryColors === "object" && !Array.isArray(data.categoryColors)) {
    writeCategoryColors(data.categoryColors as Parameters<typeof writeCategoryColors>[0]);
  }

  return NextResponse.json({ ok: true });
}
