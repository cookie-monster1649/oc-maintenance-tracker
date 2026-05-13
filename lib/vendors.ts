import fs from "fs";
import path from "path";

const DATA_PATH = path.join(process.cwd(), "data/vendors.json");

export interface Vendor {
  id: string;
  name: string;
  service_type: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  hourly_rate: number | null;
  notes: string | null;
  archived?: boolean;
}

export function readVendors(): Vendor[] {
  const raw = fs.readFileSync(DATA_PATH, "utf-8");
  return JSON.parse(raw);
}

export function writeVendors(vendors: Vendor[]): void {
  fs.writeFileSync(DATA_PATH, JSON.stringify(vendors, null, 2));
}
