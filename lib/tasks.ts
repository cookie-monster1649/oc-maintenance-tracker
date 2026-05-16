import fs from "fs";
import path from "path";
import {
  addWeeks,
  addMonths,
  addYears,
  addDays,
  parseISO,
  format,
  isBefore,
  startOfDay,
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

export interface DocumentRef {
  id: number;
  title: string;
  document_type_id: number | null;
  document_type_label: string | null;
  created: string;
  url: string;
  auto_linked: boolean;
  linked_at: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  frequency: Frequency;
  status: Status;
  start_date: string;
  last_completed_date: string | null;
  estimated_cost: number | null;
  vendor_id: string | null;
  category: string;
  archived?: boolean;
  documents?: DocumentRef[];
}

export function readTasks(): Task[] {
  if (!fs.existsSync(DATA_PATH)) {
    return [];
  }
  const raw = fs.readFileSync(DATA_PATH, "utf-8");
  const tasks: Task[] = JSON.parse(raw);
  const today = startOfDay(new Date());
  return tasks.map((t) => ({
    ...t,
    status:
      t.status !== "Completed" && t.start_date && isBefore(parseISO(t.start_date), today)
        ? "Overdue"
        : t.status,
  }));
}

export function writeTasks(tasks: Task[]): void {
  const dir = path.dirname(DATA_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(DATA_PATH, JSON.stringify(tasks, null, 2));
}

export function nextStartDate(startDate: string, frequency: Frequency): string {
  const d = parseISO(startDate);
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

export function extrapolateFutureTasks(task: Task): Task[] {
  const futureTasks: Task[] = [];
  const start = parseISO(task.start_date);
  const end = addDays(addYears(start, 1), 1);
  let current = nextStartDate(task.start_date, task.frequency);

  while (isBefore(parseISO(current), end)) {
    futureTasks.push({
      ...task,
      id: `${task.id}-${current}`,
      start_date: current,
      status: "Scheduled",
      last_completed_date: null,
      documents: [],
    });
    current = nextStartDate(current, task.frequency);
  }
  return futureTasks;
}
