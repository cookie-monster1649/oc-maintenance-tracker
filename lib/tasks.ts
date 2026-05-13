import fs from "fs";
import path from "path";
import {
  addWeeks,
  addMonths,
  addYears,
  parseISO,
  format,
  isBefore,
  startOfToday,
} from "date-fns";

const DATA_PATH = path.join(process.cwd(), "data/tasks.json");

export type Frequency =
  | "Weekly"
  | "Bi-weekly"
  | "Monthly"
  | "Quarterly"
  | "Semi-Annually"
  | "Annually";

export type Status = "Scheduled" | "In Progress" | "Completed" | "Overdue";

export interface Task {
  id: string;
  title: string;
  description: string;
  frequency: Frequency;
  status: Status;
  due_date: string;
  last_completed_date: string | null;
  estimated_cost: number | null;
  vendor_id: string | null;
  category: string;
  archived?: boolean;
}

export function readTasks(): Task[] {
  const raw = fs.readFileSync(DATA_PATH, "utf-8");
  const tasks: Task[] = JSON.parse(raw);
  const today = startOfToday();
  return tasks.map((t) => ({
    ...t,
    status:
      t.status !== "Completed" && isBefore(parseISO(t.due_date), today)
        ? "Overdue"
        : t.status,
  }));
}

export function writeTasks(tasks: Task[]): void {
  fs.writeFileSync(DATA_PATH, JSON.stringify(tasks, null, 2));
}

export function nextDueDate(dueDate: string, frequency: Frequency): string {
  const d = parseISO(dueDate);
  switch (frequency) {
    case "Weekly":
      return format(addWeeks(d, 1), "yyyy-MM-dd");
    case "Bi-weekly":
      return format(addWeeks(d, 2), "yyyy-MM-dd");
    case "Monthly":
      return format(addMonths(d, 1), "yyyy-MM-dd");
    case "Quarterly":
      return format(addMonths(d, 3), "yyyy-MM-dd");
    case "Semi-Annually":
      return format(addMonths(d, 6), "yyyy-MM-dd");
    case "Annually":
      return format(addYears(d, 1), "yyyy-MM-dd");
  }
}
