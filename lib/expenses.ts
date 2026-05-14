import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

const DATA_PATH = path.join(process.cwd(), "data/expenses.json");

export interface Expense {
  id: string;
  date_paid: string; // YYYY-MM-DD
  amount: number;
  vendor_id: string | null;
  category: string;
  description: string;
}

export function readExpenses(): Expense[] {
  if (!fs.existsSync(DATA_PATH)) {
    return [];
  }
  const raw = fs.readFileSync(DATA_PATH, "utf-8");
  return JSON.parse(raw);
}

export function writeExpenses(expenses: Expense[]): void {
  const dir = path.dirname(DATA_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(DATA_PATH, JSON.stringify(expenses, null, 2));
}

export function createExpense(
  date_paid: string,
  amount: number,
  vendor_id: string | null,
  category: string,
  description: string
): Expense {
  const id = randomUUID();
  const expense: Expense = {
    id,
    date_paid,
    amount,
    vendor_id,
    category,
    description,
  };
  const expenses = readExpenses();
  expenses.push(expense);
  writeExpenses(expenses);
  return expense;
}

export function updateExpense(id: string, updates: Partial<Expense>): Expense | null {
  const expenses = readExpenses();
  const index = expenses.findIndex((e) => e.id === id);
  if (index === -1) return null;
  const updated = { ...expenses[index], ...updates };
  expenses[index] = updated;
  writeExpenses(expenses);
  return updated;
}

export function deleteExpense(id: string): boolean {
  const expenses = readExpenses();
  const index = expenses.findIndex((e) => e.id === id);
  if (index === -1) return false;
  expenses.splice(index, 1);
  writeExpenses(expenses);
  return true;
}
