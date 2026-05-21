import { NextResponse } from "next/server";
import { readTasks, writeTasks } from "@/lib/tasks";
import { addMonths, parseISO, isAfter } from "date-fns";

export async function POST() {
  const tasks = readTasks();
  const cutoff = addMonths(new Date(), 13);

  const pruned = tasks.filter(
    (t) => t.status === "Scheduled" && isAfter(parseISO(t.start_date), cutoff)
  );
  const kept = tasks.filter(
    (t) => !(t.status === "Scheduled" && isAfter(parseISO(t.start_date), cutoff))
  );

  writeTasks(kept);

  return NextResponse.json({
    pruned: pruned.length,
    message: `Removed ${pruned.length} scheduled task(s) with start_date beyond 13 months from today.`,
  });
}
