import { NextResponse } from "next/server";
import { readTasks, writeTasks, type Task } from "@/lib/tasks";
import { readLineItems, writeLineItems, type LineItem } from "@/lib/line-items";
import { readExpenses } from "@/lib/expenses";
import { randomUUID } from "crypto";

function fyForDate(dateStr: string): number {
  const d = new Date(dateStr + "T00:00:00");
  return d.getMonth() >= 6 ? d.getFullYear() + 1 : d.getFullYear();
}

export async function POST() {
  const expenses = readExpenses();
  const tasks = readTasks();
  const lineItems = readLineItems();

  const newLineItems: LineItem[] = [];
  const newTasks: Task[] = [];

  for (const expense of expenses) {
    const lineItemId = randomUUID();

    // Create a LineItem from the expense
    const lineItem: LineItem = {
      id: lineItemId,
      title: expense.description || "(No description)",
      description: "",
      category: expense.category,
      vendor_id: expense.vendor_id || null,
      fy_budget: null,
      fy: fyForDate(expense.date_paid),
      archived: false,
    };

    // Create a Task record for the completed expense
    const task: Task = {
      id: `${lineItemId}-${expense.date_paid}`,
      line_item_id: lineItemId,
      title: null,
      description: null,
      frequency: null,
      status: "Completed",
      start_date: expense.date_paid,
      last_completed_date: expense.date_paid,
      estimated_cost: expense.amount,
      actual_cost: expense.amount,
      documents: [],
    };

    newLineItems.push(lineItem);
    newTasks.push(task);
  }

  // Merge with existing data
  const allLineItems = [...lineItems, ...newLineItems];
  const allTasks = [...tasks, ...newTasks];

  writeLineItems(allLineItems);
  writeTasks(allTasks);

  return NextResponse.json({
    migrated: newTasks.length,
    message: `Migrated ${newTasks.length} expenses to line items and tasks`,
  });
}
