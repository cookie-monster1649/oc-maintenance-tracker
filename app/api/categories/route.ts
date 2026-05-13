import { readCategories, readCategoryColors, writeCategories, writeCategoryColors, colorOptions, ColorName } from "@/lib/categoryColors";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  try {
    const categories = readCategories();
    const colors = readCategoryColors();
    const result = categories.map((cat) => ({
      name: cat,
      color: colors[cat] || "blue",
    }));
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Failed to read categories" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, color } = await request.json();

    if (!name) {
      return NextResponse.json({ error: "Category name required" }, { status: 400 });
    }

    if (color && !colorOptions.includes(color)) {
      return NextResponse.json({ error: "Invalid color" }, { status: 400 });
    }

    const categories = readCategories();
    if (categories.includes(name)) {
      return NextResponse.json({ error: "Category already exists" }, { status: 400 });
    }

    categories.push(name);
    writeCategories(categories);

    const colors = readCategoryColors();
    colors[name] = (color || "blue") as ColorName;
    writeCategoryColors(colors);

    return NextResponse.json({ name, color: colors[name] });
  } catch {
    return NextResponse.json({ error: "Failed to add category" }, { status: 500 });
  }
}
