// lib/patients/summary.ts
// สรุปผลแลบ (ครั้งแรก → ล่าสุด) และยาที่ได้รับ แบบตารางในชาร์ตของโปรแกรมเดิม — ฟังก์ชันล้วน

import type { DrugOrder, LabResult } from "./types";

/** H/L เทียบค่าปกติแบบ "a-b" หรือ "<x" (ค่าที่ไม่ใช่ตัวเลข → ไม่ flag) */
export function labFlag(value: string, normal: string | null): "H" | "L" | "" {
  const v = Number(/^[<>]?\s*(-?\d+(?:\.\d+)?)/.exec(value)?.[1]);
  if (!Number.isFinite(v) || !normal) return "";
  const range = /^(-?\d+(?:\.\d+)?)\s*-\s*(-?\d+(?:\.\d+)?)$/.exec(normal.trim());
  if (range) return v < Number(range[1]) ? "L" : v > Number(range[2]) ? "H" : "";
  const lt = /^<\s*(\d+(?:\.\d+)?)$/.exec(normal.trim());
  if (lt) return v >= Number(lt[1]) ? "H" : "";
  return "";
}

export interface LabLine {
  item: string;
  unit: string | null;
  normal: string | null;
  first: string;
  ff: "H" | "L" | "";
  /** null = ตรวจครั้งเดียว */
  last: string | null;
  lf: "H" | "L" | "";
}

export function labSummary(labs: LabResult[]): LabLine[] {
  const by = new Map<string, LabResult[]>();
  for (const l of [...labs].sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""))) {
    const list = by.get(l.name) ?? [];
    list.push(l);
    by.set(l.name, list);
  }
  return [...by.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([item, list]) => {
      const f = list[0];
      const l = list.length > 1 ? list[list.length - 1] : null;
      return {
        item,
        unit: f.unit,
        normal: f.normal,
        first: f.value,
        ff: labFlag(f.value, f.normal),
        last: l?.value ?? null,
        lf: l ? labFlag(l.value, l.normal) : "",
      };
    });
}

export interface MedLine {
  name: string;
  strength: string | null;
  qty: number | null;
}

/** รวมยาชื่อเดียวกัน (จำนวนรวม) เรียงตามลำดับที่ได้รับครั้งแรก */
export function medSummary(drugs: DrugOrder[]): MedLine[] {
  const by = new Map<string, MedLine>();
  for (const d of drugs) {
    const k = `${d.code}|${d.name}`;
    const cur = by.get(k);
    if (cur) cur.qty = cur.qty == null || d.qty == null ? (cur.qty ?? d.qty) : cur.qty + d.qty;
    else by.set(k, { name: d.name, strength: d.strength, qty: d.qty });
  }
  return [...by.values()];
}
