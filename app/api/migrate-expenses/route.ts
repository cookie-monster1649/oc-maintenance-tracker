import { NextResponse } from "next/server";
import { readTasks, writeTasks, type Task } from "@/lib/tasks";
import { readExpenses } from "@/lib/expenses";
import { randomUUID } from "crypto";

export async function POST() {
  const expenses = readExpenses();
  const tasks = readTasks();

  const newTasks: Task[] = [];

  for (const expense of expenses) {
    const seriesId = randomUUID();

    // Create a budget_item task with the expense details
    const budgetItemTask: Task = {
      id: `${seriesId}-${expense.date_paid}`,
      series_id: seriesId,
      title: expense.description || "(No description)",
      description: "",
      task_type: "budget_item",
      frequency: null,
      variable_cost: false,
      status: "Completed",
      start_date: expense.date_paid,
      last_completed_date: expense.date_paid,
      estimated_cost: expense.amount,
      actual_cost: expense.amount,
      vendor_id: expense.vendor_id,
      category: expense.category,
      documents: [],
    };

    newTasks.push(budgetItemTask);
  }

  // Merge new tasks with existing tasks
  const allTasks = [...tasks, ...newTasks];
  writeTasks(allTasks);

  return NextResponse.json({
    migrated: newTasks.length,
    message: `Migrated ${newTasks.length} expenses to budget_item tasks`,
  });
}
