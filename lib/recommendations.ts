import { Task } from "./tasks";
import { Vendor } from "./vendors";
import { PaperlessDocument } from "./paperless";
import { parseISO, differenceInDays, startOfDay } from "date-fns";

export type SmartActionType = "MATCH_COMPLETED" | "COMPLETE_SCHEDULED";

export interface SmartAction {
  type: SmartActionType;
  taskId: string;
  taskTitle: string;
  dateLabel: string;
  confidence: number;
}

export function getSmartActions(
  doc: PaperlessDocument,
  tasks: Task[],
  vendors: Vendor[],
): SmartAction[] {
  if (!doc.correspondent || !doc.created) return [];

  // Find the vendor associated with this correspondent
  const vendor = vendors.find(
    (v) => v.paperless_correspondent_id === doc.correspondent,
  );
  if (!vendor) return [];

  const docDate = startOfDay(parseISO(doc.created));
  const WINDOW = 21;

  const actions: SmartAction[] = [];

  // Filter tasks for this vendor
  const vendorTasks = tasks.filter((t) => t.vendor_id === vendor.id);

  vendorTasks.forEach((task) => {
    // 1. Check if it's a candidate for "Match Completed"
    if (task.status === "Completed" && task.last_completed_date) {
      const completionDate = startOfDay(parseISO(task.last_completed_date));
      const diff = Math.abs(differenceInDays(docDate, completionDate));

      if (diff <= WINDOW) {
        actions.push({
          type: "MATCH_COMPLETED",
          taskId: task.id,
          taskTitle: task.title,
          dateLabel: task.last_completed_date,
          confidence: (WINDOW - diff) / WINDOW,
        });
      }
    }

    // 2. Check if it's a candidate for "Complete Scheduled"
    if (task.status !== "Completed") {
      const dueDate = startOfDay(parseISO(task.start_date));
      const diff = Math.abs(differenceInDays(docDate, dueDate));

      if (diff <= WINDOW) {
        actions.push({
          type: "COMPLETE_SCHEDULED",
          taskId: task.id,
          taskTitle: task.title,
          dateLabel: task.start_date,
          confidence: (WINDOW - diff) / WINDOW,
        });
      }
    }
  });

  // Sort by confidence
  return actions.sort((a, b) => b.confidence - a.confidence);
}
