import { NextResponse } from "next/server";
import { readTasks } from "@/lib/tasks";
import { readLineItems } from "@/lib/line-items";
import { readVendors } from "@/lib/vendors";
import { readCategoryColors } from "@/lib/categoryColors";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const docId = Number(id);

    const tasks = readTasks();
    const lineItems = readLineItems();
    const vendors = readVendors();
    const categoryColors = readCategoryColors();

    const lineItemMap = new Map(lineItems.map((li) => [li.id, li]));

    // Build a map of vendor → categories (derived from their line items)
    const vendorCategories = new Map<string, Set<string>>();
    lineItems.forEach((li) => {
      if (li.vendor_id && li.category) {
        if (!vendorCategories.has(li.vendor_id)) vendorCategories.set(li.vendor_id, new Set());
        vendorCategories.get(li.vendor_id)!.add(li.category);
      }
    });

    const matchedTasks = tasks
      .filter((t) => (t.documents || []).some((d) => d.id === docId))
      .map((t) => {
        const lineItem = lineItemMap.get(t.line_item_id) ?? null;
        return {
          id: t.id,
          line_item_id: t.line_item_id,
          title: t.title,
          description: t.description,
          frequency: t.frequency,
          status: t.status,
          start_date: t.start_date,
          last_completed_date: t.last_completed_date,
          estimated_cost: t.estimated_cost,
          actual_cost: t.actual_cost,
          archived: t.archived,
          vendor_id: t.vendor_id,
          documents: [],
          line_item: lineItem
            ? {
                id: lineItem.id,
                title: lineItem.title,
                description: lineItem.description,
                category: lineItem.category,
                vendor_id: lineItem.vendor_id,
                ocy_entries: lineItem.ocy_entries,
                archived: lineItem.archived,
              }
            : null,
        };
      });

    const matchedLineItems = lineItems
      .filter((li) => (li.documents || []).some((d) => d.id === docId))
      .map((li) => ({
        id: li.id,
        title: li.title,
        description: li.description,
        category: li.category,
      }));

    const matchedVendors = vendors
      .filter((v) => (v.documents || []).some((d) => d.id === docId))
      .map((v) => ({
        id: v.id,
        name: v.name,
        service_type: v.service_type,
        categories: Array.from(vendorCategories.get(v.id) ?? []),
      }));

    return NextResponse.json({
      tasks: matchedTasks,
      lineItems: matchedLineItems,
      vendors: matchedVendors,
      categoryColors,
    });
  } catch (error) {
    console.error("Document links lookup error:", error);
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }
}
