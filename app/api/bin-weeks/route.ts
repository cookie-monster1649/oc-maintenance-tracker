import { readBinWeeks, updateBinWeeks, type BinWeeksConfig } from "@/lib/bin-weeks";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  try {
    const config = readBinWeeks();
    return NextResponse.json(config);
  } catch {
    return NextResponse.json({ error: "Failed to read bin weeks config" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const updates = await request.json();

    // Allow updating bin selections and rotation day
    const allowed = ["coming_up", "following_week", "rotation_day_of_week"];
    const filtered: Partial<BinWeeksConfig> = {};

    for (const key of allowed) {
      if (key in updates) {
        filtered[key as keyof BinWeeksConfig] = updates[key];
      }
    }

    if (Object.keys(filtered).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const config = updateBinWeeks(filtered);
    return NextResponse.json(config);
  } catch {
    return NextResponse.json({ error: "Failed to update bin weeks config" }, { status: 500 });
  }
}
