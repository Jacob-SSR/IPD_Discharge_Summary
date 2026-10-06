// lib/reports/rw.ts
// รายงาน RW/CMI — RW/AdjRW จริงจาก an_stat (ผล grouper ของ HOSxP)
// CMI = ผลรวม AdjRW / จำนวนเคสที่มี AdjRW

import { nhsoRatePerAdjRw } from "@/lib/env";
import type { RwRow } from "@/lib/patients/types";
import type { RwGroup, RwReport } from "./types";

function group(rows: RwRow[], keyOf: (r: RwRow) => [string, string]): RwGroup[] {
  const map = new Map<string, RwGroup>();
  for (const r of rows) {
    const [key, label] = keyOf(r);
    const g = map.get(key) ?? { key, label, n: 0, nWithRw: 0, sumRw: 0, sumAdjRw: 0, cmi: null };
    g.n += 1;
    if (r.adjrw != null) {
      g.nWithRw += 1;
      g.sumAdjRw += r.adjrw;
      g.sumRw += r.rw ?? 0;
    }
    map.set(key, g);
  }
  return [...map.values()].map((g) => ({
    ...g,
    sumRw: round(g.sumRw),
    sumAdjRw: round(g.sumAdjRw),
    cmi: g.nWithRw ? round(g.sumAdjRw / g.nWithRw) : null,
  }));
}

function round(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

export function buildRwReport(rows: RwRow[], from: string, to: string): RwReport {
  const rate = nhsoRatePerAdjRw();
  const [all] = group(rows, () => ["all", "ทั้งหมด"]);
  const totals = all ?? { key: "all", label: "ทั้งหมด", n: 0, nWithRw: 0, sumRw: 0, sumAdjRw: 0, cmi: null };
  return {
    from,
    to,
    totals: {
      ...totals,
      ratePerAdjRw: rate,
      estimatedRevenue: Math.round(totals.sumAdjRw * rate),
      nMissingDrg: rows.filter((r) => !r.drg || r.adjrw == null).length,
    },
    byMonth: group(rows, (r) => [r.dischargeDate.slice(0, 7), r.dischargeDate.slice(0, 7)]).sort((a, b) =>
      a.key.localeCompare(b.key),
    ),
    byWard: group(rows, (r) => [r.wardCode ?? "-", r.wardName ?? r.wardCode ?? "ไม่ระบุ"]).sort((a, b) => b.sumAdjRw - a.sumAdjRw),
    byDoctor: group(rows, (r) => [r.dischargeDoctor?.code ?? "-", r.dischargeDoctor?.name ?? "ไม่ระบุ"]).sort(
      (a, b) => b.sumAdjRw - a.sumAdjRw,
    ),
  };
}
