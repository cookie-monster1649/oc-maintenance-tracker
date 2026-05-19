import { NextResponse } from "next/server";
import { readLineItems, writeLineItems, type LineItem } from "@/lib/line-items";

export async function GET() {
  return NextResponse.json(readLineItems());
}

export async function POST(req: Request) {
  const body = await req.json();
  const lineItems = readLineItems();

  const lineItem: LineItem = {
    id: crypto.randomUUID(),
    title: body.title,
    description: body.description ?? "",
    category: body.category,
    vendor_id: body.vendor_id ?? null,
    fy_budget: body.fy_budget ? Number(body.fy_budget) : null,
    archived: false,
  };

  lineItems.push(lineItem);
  writeLineItems(lineItems);
  return NextResponse.json(lineItem, { status: 201 });
}
