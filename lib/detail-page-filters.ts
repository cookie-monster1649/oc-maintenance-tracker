import type { Task } from "@/lib/tasks";

export interface TaskFilterContext {
  tasks: Task[];
  lineItemId?: string;
  vendorId?: string;
  lineItemVendorMap?: Map<string, string | null>;
}

export function getEffectiveVendorId(
  task: Task,
  lineItemVendorMap?: Map<string, string | null>,
): string | null {
  return task.vendor_id ?? (lineItemVendorMap?.get(task.line_item_id) ?? null);
}

export function filterUpcomingTasks(context: TaskFilterContext): Task[] {
  const { tasks, lineItemId, vendorId, lineItemVendorMap } = context;

  return tasks.filter((t) => {
    if (t.status === "Completed") return false;

    if (lineItemId) {
      return t.line_item_id === lineItemId;
    }

    if (vendorId && lineItemVendorMap) {
      const effectiveVendorId = getEffectiveVendorId(t, lineItemVendorMap);
      return effectiveVendorId === vendorId;
    }

    return false;
  });
}

export function filterCompletedTasks(context: TaskFilterContext): Task[] {
  const { tasks, lineItemId, vendorId, lineItemVendorMap } = context;

  return tasks.filter((t) => {
    if (t.status !== "Completed") return false;

    if (lineItemId) {
      return t.line_item_id === lineItemId;
    }

    if (vendorId && lineItemVendorMap) {
      const effectiveVendorId = getEffectiveVendorId(t, lineItemVendorMap);
      return effectiveVendorId === vendorId;
    }

    return false;
  });
}

export function deduplicateTasks(tasks: Task[]): Task[] {
  const seen = new Set<string>();
  return tasks.filter((t) => {
    const key = `${t.line_item_id}|${t.start_date}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function getTaskPatterns(tasks: Task[]): Map<
  string,
  {
    title: string;
    frequency: string | null;
    estimated_cost: number | null;
    vendor_id: string | null;
  }
> {
  const patterns = new Map<
    string,
    {
      title: string;
      frequency: string | null;
      estimated_cost: number | null;
      vendor_id: string | null;
    }
  >();

  for (const task of tasks) {
    const key = `${task.title}|${task.frequency}`;
    if (!patterns.has(key)) {
      patterns.set(key, {
        title: task.title || "Untitled",
        frequency: task.frequency,
        estimated_cost: task.estimated_cost,
        vendor_id: task.vendor_id ?? null,
      });
    }
  }

  return patterns;
}
