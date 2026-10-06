// lib/drg/caseEstimate.ts
// ประมาณ DRG/RW ของชุดรหัสหนึ่งชุด (ก่อน/หลังแพทย์ยืนยันรหัส) จากผลจัดกลุ่มย้อนหลัง 2 ปีงบ

import type { FinalCode } from "@/lib/coding/final";
import { addDays, fiscalYearBE, fiscalYearRange, todayIso } from "@/lib/date";
import type { PatientSource } from "@/lib/patients/types";
import { estimateGroup, type GroupEstimate } from "./estimate";
import { getTdrgTables, isOrProcedure } from "./tables";

export async function estimateForCodes(
  source: PatientSource,
  codes: FinalCode[],
  los: number | null,
): Promise<GroupEstimate> {
  const pdx = codes.find((c) => c.system === "ICD10" && c.diagtype === "1")?.code ?? null;
  const sdxCount = codes.filter((c) => c.system === "ICD10" && c.diagtype !== "1").length;
  const tables = getTdrgTables();
  const procs = codes.filter((c) => c.system === "ICD9CM");
  let hasOr: boolean | null = null;
  if (procs.some((p) => p.orType === "OR")) hasOr = true;
  else {
    const fromTable = procs.map((p) => isOrProcedure(p.code, tables));
    if (fromTable.some((x) => x === true)) hasOr = true;
    else if (fromTable.length === 0 || fromTable.every((x) => x === false)) hasOr = tables.orp.size ? false : null;
  }

  if (!pdx) return estimateGroup([], { pdx: null, sdxCount, hasOr, los }, tables);
  const today = todayIso();
  const from = fiscalYearRange(fiscalYearBE(today) - 2).from;
  const groups = await source.historicalGroups(pdx, from, addDays(today, -1));
  return estimateGroup(groups, { pdx, sdxCount, hasOr, los }, tables);
}
