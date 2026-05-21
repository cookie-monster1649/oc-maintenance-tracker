import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import {
  addWeeks,
  addMonths,
  addYears,
  parseISO,
  format,
  isBefore,
  startOfDay,
} from "date-fns";

const DATA_PATH = path.join(process.cwd(), "data/tasks.json");
const LINE_ITEMS_PATH = path.join(process.cwd(), "data/line_items.json");

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
  line_item_id: string;
  title: string | null;
  description: string | null;
  frequency: Frequency | null;
  start_date: string;
  end_date: string | null;
  estimated_cost: number | null;
  actual_cost: number | null;
  status: Status;
  last_completed_date: string | null;
  documents: DocumentRef[];
  archived?: boolean;
  vendor_id?: string | null;
}

export function readTasks(): Task[] {
  if (!fs.existsSync(DATA_PATH)) {
    return [];
  }
  const raw = fs.readFileSync(DATA_PATH, "utf-8");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw_tasks: any[] = JSON.parse(raw);

  // Migrate to line_item_id model (from series_id model)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawTasks = raw_tasks as any[];
  const needsLineItemMigration =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rawTasks.some((t: any) => t.series_id && !t.line_item_id) ||
    !fs.existsSync(LINE_ITEMS_PATH);

  let finalTasks: Task[] = rawTasks;
  if (needsLineItemMigration) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lineItems: any[] = [];
    const migratedTasks: Task[] = [];

    // Group tasks by series_id to create line items
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const groupedBySeries = new Map<string, any[]>();
    for (const t of rawTasks) {
      const seriesId = t.series_id || randomUUID();
      if (!groupedBySeries.has(seriesId)) {
        groupedBySeries.set(seriesId, []);
      }
      groupedBySeries.get(seriesId)!.push(t);
    }

    // Process each series group
    for (const [, tasksInSeries] of groupedBySeries) {
      const taskType = tasksInSeries[0].task_type || "once_off";

      if (taskType === "budget_item") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const budgetItemTask = tasksInSeries.find((t: any) => t.task_type === "budget_item");
        if (budgetItemTask) {
          const lineItemId = randomUUID();
          lineItems.push({
            id: lineItemId,
            title: budgetItemTask.title,
            description: budgetItemTask.description || "",
            category: budgetItemTask.category,
            vendor_id: budgetItemTask.vendor_id || null,
            fy_budget: budgetItemTask.estimated_cost || null,
            archived: budgetItemTask.archived || false,
          });

          // Only include child tasks (skip the budget_item itself)
          for (const t of tasksInSeries) {
            if (t.task_type !== "budget_item") {
              migratedTasks.push({
                id: t.id,
                line_item_id: lineItemId,
                title: t.title || null,
                description: t.description || null,
                frequency: t.frequency,
                start_date: t.start_date,
                end_date: t.end_date || null,
                estimated_cost: t.estimated_cost || null,
                actual_cost: t.actual_cost || null,
                status: t.status,
                last_completed_date: t.last_completed_date || null,
                documents: t.documents || [],
                archived: t.archived || false,
              });
            }
          }
        }
      } else {
        const lineItemId = randomUUID();
        const firstTask = tasksInSeries[0];
        lineItems.push({
          id: lineItemId,
          title: firstTask.title,
          description: firstTask.description || "",
          category: firstTask.category,
          vendor_id: firstTask.vendor_id || null,
          fy_budget: null,
          archived: firstTask.archived || false,
        });

        for (const t of tasksInSeries) {
          migratedTasks.push({
            id: t.id,
            line_item_id: lineItemId,
            title: t.title || null,
            description: t.description || null,
            frequency: t.frequency,
            start_date: t.start_date,
            end_date: t.end_date || null,
            estimated_cost: t.estimated_cost || null,
            actual_cost: t.actual_cost || null,
            status: t.status,
            last_completed_date: t.last_completed_date || null,
            documents: t.documents || [],
            archived: t.archived || false,
          });
        }
      }
    }

    finalTasks = migratedTasks;
    fs.writeFileSync(DATA_PATH, JSON.stringify(migratedTasks, null, 2));
    fs.writeFileSync(LINE_ITEMS_PATH, JSON.stringify(lineItems, null, 2));
  }

  const tasks: Task[] = finalTasks;

  // Deduplicate by line_item_id + start_date, keeping the most recent status (Completed wins)
  const seen = new Map<string, Task>();
  for (const t of tasks) {
    const key = `${t.line_item_id}|${t.start_date}`;
    const existing = seen.get(key);
    if (!existing || t.status === "Completed") {
      seen.set(key, t);
    }
  }
  const dedupedTasks = Array.from(seen.values());

  const today = startOfDay(new Date());
  return dedupedTasks
    .sort((a, b) => (a.start_date || "").localeCompare(b.start_date || ""))
    .map((t) => ({
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

export function nextStartDate(startDate: string, frequency: Frequency | null): string {
  if (!frequency) throw new Error("Cannot calculate next start date for non-recurring task");
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
    default:
      throw new Error(`Unknown frequency: ${frequency}`);
  }
}

export function pushFutureTasks(tasks: Task[], futureTasks: Task[]): void {
  for (const fTask of futureTasks) {
    const exists = tasks.some(
      (t) => t.line_item_id === fTask.line_item_id && t.start_date === fTask.start_date,
    );
    if (!exists) tasks.push(fTask);
  }
}

export function extrapolateFutureTasks(task: Task): Task[] {
  if (!task.frequency) return [];
  const futureTasks: Task[] = [];
  // 13-month window covers the next full OC year from any starting point.
  // The 3-task cap limits quantity for high-frequency tasks (weekly, bi-weekly).
  const cutoff = task.end_date ? parseISO(task.end_date) : addMonths(parseISO(task.start_date), 13);
  let current = nextStartDate(task.start_date, task.frequency);

  while (futureTasks.length < 3 && isBefore(parseISO(current), cutoff)) {
    futureTasks.push({
      ...task,
      id: `${task.line_item_id}-${current}`,
      line_item_id: task.line_item_id,
      start_date: current,
      status: "Scheduled",
      last_completed_date: null,
      documents: [],
    });
    current = nextStartDate(current, task.frequency);
  }
  return futureTasks;
}
