import { NextResponse } from "next/server";
import { listCorrespondents } from "@/lib/paperless";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const correspondents = await listCorrespondents();
    return NextResponse.json(correspondents);
  } catch (error: any) {
    console.error("Paperless API error:", error);
    return NextResponse.json(
      { error: "Paperless-ngx unreachable" },
      { status: 502 },
    );
  }
}
