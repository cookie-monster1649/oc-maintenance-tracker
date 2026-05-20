import { NextResponse } from "next/server";
import { readLineItems, writeLineItems, type LineItem } from "@/lib/line-items";

export async function GET() {
  return NextResponse.json(readLineItems());
}

export async function POST(req: Request) {
  const body = await req.json();
  const lineItems = readLineItems();

  const currentOCYear = new Date().getMonth() >= 3 ? new Date().getFullYear() + 1 : new Date().getFullYear();
  const ocyYear = body.ocy || body.fy ? Number(body.ocy || body.fy) : currentOCYear;
  const budget = body.ocy_budget || body.fy_budget ? Number(body.ocy_budget || body.fy_budget) : null;

  const lineItem: LineItem = {
    id: crypto.randomUUID(),
    title: body.title,
    description: body.description ?? "",
    category: body.category,
    vendor_id: body.vendor_id ?? null,
    ocy_entries: body.ocy_entries ? body.ocy_entries : [{ year: ocyYear, budget }],
    archived: false,
  };

  lineItems.push(lineItem);
  writeLineItems(lineItems);
  return NextResponse.json(lineItem, { status: 201 });
}
