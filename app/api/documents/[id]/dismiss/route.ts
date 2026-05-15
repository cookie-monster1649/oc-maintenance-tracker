import { NextResponse } from "next/server";
import { addDismissed, removeDismissed } from "@/lib/dismissed";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  addDismissed(parseInt(id, 10));
  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  removeDismissed(parseInt(id, 10));
  return NextResponse.json({ success: true });
}
