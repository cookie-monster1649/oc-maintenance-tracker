import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
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
  series_id: string;
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw_tasks: any[] = JSON.parse(raw);

  let needsWrite = false;

  // Migrate due_date → start_date for tasks created before the field rename
  const withStartDate = raw_tasks.map((t) => {
    if (!t.start_date && t.due_date) {
      needsWrite = true;
      const { due_date, ...rest } = t;
      return { ...rest, start_date: due_date };
    }
    return t;
  });

  // Backfill missing series_id by grouping tasks with the same title
  const seriesMap = new Map<string, string>();
  const withSeriesId = withStartDate.map((t) => {
    if (!t.series_id) {
      needsWrite = true;
      if (!seriesMap.has(t.title)) {
        seriesMap.set(t.title, randomUUID());
      }
      return { ...t, series_id: seriesMap.get(t.title) };
    }
    return t;
  });

  // Migrate corrupt IDs: tasks that accumulated multiple dates (e.g. base-2025-09-30-2025-11-30)
  // due to extrapolateFutureTasks being called on already-dated task IDs.
  // Clean IDs should always be series_id-start_date.
  const seenIds = new Set<string>();
  const withCleanIds = withSeriesId.reduce((acc: any[], t: any) => {
    const dateCount = (t.id.match(/-\d{4}-\d{2}-\d{2}/g) || []).length;
    const cleanId = dateCount > 1 ? `${t.series_id}-${t.start_date}` : t.id;
    if (dateCount > 1) needsWrite = true;
    if (!seenIds.has(cleanId)) {
      seenIds.add(cleanId);
      acc.push(dateCount > 1 ? { ...t, id: cleanId } : t);
    } else {
      needsWrite = true; // drop duplicate after ID normalisation
    }
    return acc;
  }, []);

  if (needsWrite) {
    fs.writeFileSync(DATA_PATH, JSON.stringify(withCleanIds, null, 2));
  }

  const tasks: Task[] = withCleanIds;
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

export function pushFutureTasks(tasks: Task[], futureTasks: Task[]): void {
  for (const fTask of futureTasks) {
    const exists = tasks.some(
      (t) => t.series_id === fTask.series_id && t.start_date === fTask.start_date,
    );
    if (!exists) tasks.push(fTask);
  }
}

export function extrapolateFutureTasks(task: Task): Task[] {
  const futureTasks: Task[] = [];
  const cutoff = addYears(parseISO(task.start_date), 1);
  let current = nextStartDate(task.start_date, task.frequency);

  while (futureTasks.length < 3 && isBefore(parseISO(current), cutoff)) {
    futureTasks.push({
      ...task,
      id: `${task.series_id}-${current}`,
      series_id: task.series_id,
      start_date: current,
      status: "Scheduled",
      last_completed_date: null,
      documents: [],
    });
    current = nextStartDate(current, task.frequency);
  }
  return futureTasks;
}
