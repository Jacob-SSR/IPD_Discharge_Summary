// lib/drg/tables.ts
// ตาราง DRG (TDRG 6.3) — ต้องเติมจากคู่มือที่ผู้ใช้ให้มาเท่านั้น ห้ามเดาค่า RW
//   data/tdrg/tdrg_rw_table.csv   คอลัมน์: drg,description,rw,wtlos,ot,rw0d,of
// ยังไม่มีไฟล์จริง → ไม่มีตาราง (ใช้ RW เฉลี่ยจากผลจัดกลุ่มย้อนหลังแทน)
// โหมด demo → data/tdrg/demo/tdrg_rw_table.csv จากสนามลอง AI ให้รหัส (ค่าสมมติ ต้องยืนยันด้วย TDRG Seeker)
// OR / Non-OR ของหัตถการมาจาก codebook ICD-9-CM ฉบับ สรท. (lib/coding/codebook.ts → procClass)

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseCsv } from "@/lib/coding/codebook";
import { isDemo } from "@/lib/env";

export interface DrgParams {
  drg: string;
  description: string;
  rw: number;
  wtlos: number;
  ot: number;
  rw0d: number | null;
  of: number | null;
}

export interface TdrgTables {
  source: string | null;
  isDemo: boolean;
  rw: Map<string, DrgParams>;
}

function num(s: string | undefined): number | null {
  if (s == null || s.trim() === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function parseRwTable(text: string): Map<string, DrgParams> {
  const rows = parseCsv(text.replace(/^\uFEFF/, ""));
  const header = (rows[0] ?? []).map((h) => h.trim().toLowerCase());
  const map = new Map<string, DrgParams>();
  for (const r0 of rows.slice(1)) {
    const r = Object.fromEntries(header.map((h, i) => [h, (r0[i] ?? "").trim()]));
    const rw = num(r.rw);
    const wtlos = num(r.wtlos);
    const ot = num(r.ot);
    if (!r.drg || rw == null || wtlos == null || ot == null) continue;
    map.set(r.drg, { drg: r.drg, description: r.description ?? "", rw, wtlos, ot, rw0d: num(r.rw0d), of: num(r.of) });
  }
  return map;
}

let cached: TdrgTables | null = null;

export function tdrgDir(): string {
  return path.join(process.cwd(), "data", "tdrg");
}

export function getTdrgTables(): TdrgTables {
  if (cached) return cached;
  const dir = tdrgDir();
  const real = path.join(dir, "tdrg_rw_table.csv");
  const useDemo = !existsSync(real) && isDemo();
  const file = useDemo ? path.join(dir, "demo", "tdrg_rw_table.csv") : real;
  cached = {
    source: existsSync(file) ? path.relative(dir, file) : null,
    isDemo: useDemo,
    rw: existsSync(file) ? parseRwTable(readFileSync(file, "utf8")) : new Map(),
  };
  return cached;
}

/** เอกสารอ้างอิงสูตร/ตาราง + อัตราจ่าย (data/tdrg/refs.json) */
export function tdrgRefs(): { refs: [string, string][]; base_rate: number } {
  return JSON.parse(readFileSync(path.join(tdrgDir(), "refs.json"), "utf8"));
}
