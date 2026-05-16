"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getColorClasses } from "@/lib/colors";
import { getCached, setCached } from "@/lib/cache";

interface CategoryColor {
  name: string;
  color: string;
}

interface Task {
  id: string;
  title: string;
  description: string;
  frequency: string;
  status: "Scheduled" | "In Progress" | "Completed" | "Overdue";
  start_date: string;
  estimated_cost: number | null;
  vendor_id: string | null;
  category: string;
  archived?: boolean;
}

interface Vendor {
  id: string;
  name: string;
  service_type: string;
  email: string | null;
  phone: string | null;
  archived?: boolean;
}

function fmt(n: number): string {
  return n.toLocaleString("en-AU", { style: "currency", currency: "AUD" });
}

export default function ArchivedPage() {
  const [tasks, setTasks] = useState<Task[]>(() =>
    (getCached<Task[]>("/api/tasks") ?? []).filter((t) => t.archived),
  );
  const [vendors, setVendors] = useState<Vendor[]>(() =>
    (getCached<Vendor[]>("/api/vendors") ?? []).filter((v) => v.archived),
  );
  const [categoryColors, setCategoryColors] = useState<Record<string, string>>(
    () =>
      (
        getCached<{ name: string; color: string }[]>("/api/categories") ?? []
      ).reduce((acc: Record<string, string>, c) => {
        acc[c.name] = c.color;
        return acc;
      }, {}),
  );
  const [unarchiving, setUnarchiving] = useState<string | null>(null);

  async function fetchAll() {
    const [tasksRes, vendorsRes, categoriesRes] = await Promise.all([
      fetch("/api/tasks"),
      fetch("/api/vendors"),
      fetch("/api/categories"),
    ]);
    const [tasksData, vendorsData, categoriesData] = await Promise.all([
      tasksRes.json(),
      vendorsRes.json(),
      categoriesRes.json(),
    ]);
    setCached("/api/tasks", tasksData);
    setCached("/api/vendors", vendorsData);
    setCached("/api/categories", categoriesData);
    setTasks(tasksData.filter((t: Task) => t.archived));
    setVendors(vendorsData.filter((v: Vendor) => v.archived));
    setCategoryColors(
      categoriesData.reduce((acc: Record<string, string>, c: CategoryColor) => {
        acc[c.name] = c.color;
        return acc;
      }, {}),
    );
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAll();
  }, []);

  async function unarchiveTask(id: string) {
    setUnarchiving(id);
    await fetch(`/api/tasks/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: false }),
    });
    await fetchAll();
    setUnarchiving(null);
  }

  async function unarchiveVendor(id: string) {
    setUnarchiving(id);
    await fetch(`/api/vendors/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: false }),
    });
    await fetchAll();
    setUnarchiving(null);
  }

  const isEmpty = tasks.length === 0 && vendors.length === 0;

  return (
    <main className="animate-page content-container py-10">
      <Link
        href="/"
        className="text-sm text-gray-400 hover:text-gray-600 mb-8 inline-block"
      >
        ← Back
      </Link>

      <div className="mb-12">
        <h1 className="text-4xl font-bold mb-2">Archived Items</h1>
        <p className="text-base text-gray-600">
          {isEmpty
            ? "No archived tasks or vendors yet."
            : "Restore archived tasks and vendors."}
        </p>
      </div>

      {tasks.length > 0 && (
        <section className="mb-12">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-6">
            Archived Tasks ({tasks.length})
          </h2>
          <div className="space-y-4">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="flex items-start justify-between gap-4 py-4 border-b border-gray-100 last:border-0"
              >
                <Link
                  href={`/tasks/${task.id}`}
                  className="flex-1 min-w-0 group"
                >
                  <h3 className="font-medium text-gray-900 mb-1 group-hover:underline">
                    {task.title}
                  </h3>
                  <p className="text-sm text-gray-500 mb-2">
                    {task.description}
                  </p>
                  <div className="flex items-center gap-4 text-xs">
                    {(() => {
                      const colors = getColorClasses(
                        categoryColors[task.category] || "blue",
                      );
                      return (
                        <span
                          className={`px-2 py-0.5 rounded-full ${colors.bg} ${colors.text} font-medium`}
                        >
                          {task.category}
                        </span>
                      );
                    })()}
                    <span className="text-gray-400">{task.start_date}</span>
                    {task.estimated_cost && (
                      <span className="text-gray-400">
                        {fmt(task.estimated_cost)}
                      </span>
                    )}
                  </div>
                </Link>
                <button
                  onClick={() => unarchiveTask(task.id)}
                  disabled={unarchiving === task.id}
                  className="text-sm px-3 py-1.5 rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-40 transition-colors shrink-0 whitespace-nowrap"
                >
                  {unarchiving === task.id ? "Restoring…" : "Restore"}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {vendors.length > 0 && (
        <section className="mb-12">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-6">
            Archived Vendors ({vendors.length})
          </h2>
          <div className="space-y-4">
            {vendors.map((vendor) => (
              <div
                key={vendor.id}
                className="flex items-start justify-between gap-4 py-4 border-b border-gray-100 last:border-0"
              >
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900 mb-1">
                    {vendor.name}
                  </h3>
                  <div className="text-xs text-gray-500">
                    {vendor.service_type}
                    {vendor.phone && ` · ${vendor.phone}`}
                  </div>
                </div>
                <button
                  onClick={() => unarchiveVendor(vendor.id)}
                  disabled={unarchiving === vendor.id}
                  className="text-sm px-3 py-1.5 rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-40 transition-colors shrink-0 whitespace-nowrap"
                >
                  {unarchiving === vendor.id ? "Restoring…" : "Restore"}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {isEmpty && (
        <div className="text-center py-12">
          <p className="text-gray-400">Nothing here yet.</p>
        </div>
      )}
    </main>
  );
}
