import { readExpenses, createExpense } from "@/lib/expenses";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  try {
    const expenses = readExpenses();
    return NextResponse.json(expenses);
  } catch {
    return NextResponse.json({ error: "Failed to read expenses" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { date_paid, amount, vendor_id, category, description } = body;

    if (!date_paid || amount === undefined || !category) {
      return NextResponse.json(
        { error: "Missing required fields: date_paid, amount, category" },
        { status: 400 }
      );
    }

    const expense = createExpense(date_paid, amount, vendor_id || null, category, description || "");
    return NextResponse.json(expense, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create expense" }, { status: 500 });
  }
}
