import { NextResponse } from "next/server";
import { readVendors, writeVendors } from "@/lib/vendors";

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const vendors = readVendors();
  const idx = vendors.findIndex((v) => v.id === id);

  if (idx === -1) {
    return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
  }

  vendors[idx] = {
    ...vendors[idx],
    name: body.name ?? vendors[idx].name,
    service_type: body.service_type ?? vendors[idx].service_type,
    email: body.email ?? null,
    phone: body.phone ?? null,
    address: body.address ?? null,
    hourly_rate: body.hourly_rate ? Number(body.hourly_rate) : null,
    notes: body.notes ?? null,
    archived: body.archived ?? vendors[idx].archived,
    paperless_correspondent_id:
      body.paperless_correspondent_id ??
      vendors[idx].paperless_correspondent_id,
  };

  writeVendors(vendors);
  return NextResponse.json(vendors[idx]);
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const vendors = readVendors();
  const filtered = vendors.filter((v) => v.id !== id);

  if (filtered.length === vendors.length) {
    return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
  }

  writeVendors(filtered);
  return new Response(null, { status: 204 });
}
