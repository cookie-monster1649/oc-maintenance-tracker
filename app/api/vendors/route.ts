import { NextResponse } from "next/server";
import { readVendors, writeVendors, type Vendor } from "@/lib/vendors";

export async function GET() {
  return NextResponse.json(readVendors());
}

export async function POST(req: Request) {
  const body = await req.json();
  const vendors = readVendors();

  const vendor: Vendor = {
    id: crypto.randomUUID(),
    name: body.name,
    service_type: body.service_type,
    email: body.email ?? null,
    phone: body.phone ?? null,
    address: body.address ?? null,
    hourly_rate: body.hourly_rate ? Number(body.hourly_rate) : null,
    notes: body.notes ?? null,
  };

  vendors.push(vendor);
  writeVendors(vendors);
  return NextResponse.json(vendor, { status: 201 });
}
