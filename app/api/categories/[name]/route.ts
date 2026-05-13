import { readCategories, readCategoryColors, writeCategories, writeCategoryColors, colorOptions, ColorName, getCategoryColor } from "@/lib/categoryColors";
import { NextRequest, NextResponse } from "next/server";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    const { color } = await request.json();

    if (!color || !colorOptions.includes(color)) {
      return NextResponse.json({ error: "Invalid color" }, { status: 400 });
    }

    const categories = readCategories();
    if (!categories.includes(name)) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    const colors = readCategoryColors();
    colors[name] = color as ColorName;
    writeCategoryColors(colors);

    return NextResponse.json({ name, color });
  } catch {
    return NextResponse.json({ error: "Failed to update category" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;

    const categories = readCategories();
    if (!categories.includes(name)) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    const updated = categories.filter((c) => c !== name);
    writeCategories(updated);

    const colors = readCategoryColors();
    delete colors[name];
    writeCategoryColors(colors);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete category" }, { status: 500 });
  }
}
