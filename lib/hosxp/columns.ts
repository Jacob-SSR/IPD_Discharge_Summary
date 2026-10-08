// lib/hosxp/columns.ts
// ชื่อคอลัมน์บางตัวต่างกันตามเวอร์ชัน HOSxP — ตรวจจากตารางจริงผ่าน information_schema แล้วเลือกตัวที่มี
// (วิธีเดียวกับ lib/bloodTransfusion.service.ts ของ ppc-hos-10667)
// ชื่อคอลัมน์ที่นำไปต่อใน SQL มาจากรายการคงที่ด้านล่างเท่านั้น ไม่ได้มาจากผู้ใช้

import { hosxpQuery } from "./pool";

/** แพทย์ผู้รับไว้ใน ipt */
export const ADMIT_DOCTOR_CANDIDATES = ["admdoctor", "incharge_doctor", "adm_doctor"] as const;
/** วันที่ทำหัตถการใน iptoprt (คอลัมน์วันที่ หรือ datetime) */
export const OPDATE_CANDIDATES = ["opdate", "begin_date_time", "begin_datetime", "begin_date", "oper_date", "start_date"] as const;
/** วันที่สั่งยาใน opitemrece (ppc-hos ใช้ vstdate) */
export const RXDATE_CANDIDATES = ["rxdate", "vstdate"] as const;
/** แพทย์ผู้ทำหัตถการใน iptoprt */
export const OPDOCTOR_CANDIDATES = ["doctor", "opdoctor", "doctor_code"] as const;

export interface ResolvedColumns {
  /** ipt.<col> หรือ null ถ้าไม่มี (ตัวกรอง "แพทย์ผู้รับไว้" จะไม่มีผล) */
  admitDoctor: string | null;
  opDate: string | null;
  opDoctor: string | null;
  rxDate: string | null;
  /** lab ของผู้ป่วยในผูกกับ AN ผ่าน lab_head.an (ถ้ามี) และ/หรือ lab_head.vn */
  labHasAn: boolean;
}

let cached: Promise<ResolvedColumns> | null = null;

export async function tableColumns(table: string): Promise<Set<string>> {
  const rows = await hosxpQuery<{ c: string }>(
    `SELECT LOWER(COLUMN_NAME) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table],
  );
  return new Set(rows.map((r) => String(r.c)));
}

export function pick(cols: Set<string>, candidates: readonly string[]): string | null {
  return candidates.find((c) => cols.has(c)) ?? null;
}

export function resolveColumns(): Promise<ResolvedColumns> {
  if (!cached) {
    cached = (async () => {
      const [ipt, oprt, lab, item] = await Promise.all([
        tableColumns("ipt"),
        tableColumns("iptoprt"),
        tableColumns("lab_head"),
        tableColumns("opitemrece"),
      ]);
      return {
        admitDoctor: pick(ipt, ADMIT_DOCTOR_CANDIDATES),
        opDate: pick(oprt, OPDATE_CANDIDATES),
        opDoctor: pick(oprt, OPDOCTOR_CANDIDATES),
        rxDate: pick(item, RXDATE_CANDIDATES),
        labHasAn: lab.has("an"),
      };
    })().catch((e) => {
      cached = null;
      throw e;
    });
  }
  return cached;
}
