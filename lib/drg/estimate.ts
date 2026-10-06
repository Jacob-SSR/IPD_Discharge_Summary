// lib/drg/estimate.ts
// ประมาณ DRG/RW จาก "ผลจัดกลุ่มย้อนหลัง" — ดูว่าเคสในอดีตที่มี PDx เดียวกันถูก grouper จัดเข้า DRG ใด
// แล้วเลือกกลุ่มที่ใกล้เคียงที่สุด (มี/ไม่มีหัตถการ OR, จำนวน SDx)
// เป็น "ค่าประมาณ" เท่านั้น — ไม่ใช่ grouper จริง ใช้ดูทิศทางว่ารหัสที่เพิ่มอาจทำให้ RW เปลี่ยนหรือไม่

import type { HistoricalGroup } from "@/lib/patients/types";
import { computeAdjRw, type LosKind } from "./adjrw";
import type { TdrgTables } from "./tables";

export interface CaseShape {
  pdx: string | null;
  sdxCount: number;
  /** มีหัตถการ OR หรือไม่ (null = ไม่ทราบ เพราะยังไม่มีตาราง ORP) */
  hasOr: boolean | null;
  los: number | null;
}

export interface GroupEstimate {
  drg: string | null;
  /** จำนวนเคสย้อนหลังที่ใช้อ้างอิง */
  basisN: number;
  rw: number | null;
  adjrw: number | null;
  adjrwFrom: "formula" | "history" | null;
  losKind: LosKind | null;
  note: string;
}

export function pickGroup(groups: HistoricalGroup[], shape: CaseShape): HistoricalGroup | null {
  if (!groups.length) return null;
  let pool = groups;
  if (shape.hasOr != null) {
    const sameOr = groups.filter((g) => g.hasOr === shape.hasOr);
    if (sameOr.length) pool = sameOr;
  }
  return [...pool].sort((a, b) => {
    const da = Math.abs((a.avgSdx ?? 0) - shape.sdxCount);
    const db = Math.abs((b.avgSdx ?? 0) - shape.sdxCount);
    return da !== db ? da - db : b.n - a.n;
  })[0];
}

export function estimateGroup(
  groups: HistoricalGroup[],
  shape: CaseShape,
  tables: TdrgTables,
): GroupEstimate {
  if (!shape.pdx) {
    return { drg: null, basisN: 0, rw: null, adjrw: null, adjrwFrom: null, losKind: null, note: "ยังไม่มี PDx" };
  }
  const g = pickGroup(groups, shape);
  if (!g) {
    return {
      drg: null,
      basisN: 0,
      rw: null,
      adjrw: null,
      adjrwFrom: null,
      losKind: null,
      note: `ไม่มีเคสย้อนหลังที่ PDx = ${shape.pdx}`,
    };
  }
  const params = tables.rw.get(g.drg);
  if (params && shape.los != null) {
    const r = computeAdjRw(params, shape.los);
    return {
      drg: g.drg,
      basisN: g.n,
      rw: params.rw,
      adjrw: r.adjrw,
      adjrwFrom: "formula",
      losKind: r.kind,
      note: `อ้างอิง ${g.n} เคสย้อนหลัง + ตาราง TDRG${tables.isDemo ? " (demo)" : ""}`,
    };
  }
  return {
    drg: g.drg,
    basisN: g.n,
    rw: g.avgRw,
    adjrw: g.avgAdjRw,
    adjrwFrom: g.avgAdjRw != null ? "history" : null,
    losKind: null,
    note: `ค่าเฉลี่ยจาก ${g.n} เคสย้อนหลัง (ยังไม่มีตาราง TDRG สำหรับ ${g.drg})`,
  };
}
