import { NextResponse } from "next/server";
import { readCategories, writeCategories } from "@/lib/categories";

export async function GET() {
  return NextResponse.json(readCategories());
}

export async function POST(req: Request) {
  const body = await req.json();
  const categories = readCategories();

  if (!body.name || categories.includes(body.name)) {
    return NextResponse.json({ error: "Invalid or duplicate category" }, { status: 400 });
  }

  categories.push(body.name);
  writeCategories(categories);
  return NextResponse.json(categories, { status: 201 });
}
