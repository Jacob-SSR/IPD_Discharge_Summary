// lib/patients/filter.ts
// แปลง query string → AdmissionFilter พร้อมตรวจรูปแบบ (กันค่าแปลกปลอมเข้า SQL)

import { isIsoDate } from "@/lib/date";
import type { AdmissionFilter, PendingStatus } from "./types";

const CODE_RE = /^[A-Za-z0-9_-]{1,20}$/;

function date(v: string | null): string | undefined {
  return v && isIsoDate(v) ? v : undefined;
}

function code(v: string | null): string | undefined {
  return v && CODE_RE.test(v) ? v : undefined;
}

export function parseFilter(sp: URLSearchParams): AdmissionFilter {
  const q = sp.get("q")?.trim();
  const status = sp.get("pendingStatus");
  return {
    admitFrom: date(sp.get("admitFrom")),
    admitTo: date(sp.get("admitTo")),
    dischargeFrom: date(sp.get("dischargeFrom")),
    dischargeTo: date(sp.get("dischargeTo")),
    ward: code(sp.get("ward")),
    admitDoctor: code(sp.get("admitDoctor")),
    dischargeDoctor: code(sp.get("dischargeDoctor")),
    pdxDoctor: code(sp.get("pdxDoctor")),
    q: q && /^[0-9]{1,15}$/.test(q) ? q : undefined,
    pending: sp.get("pending") === "1",
    pendingStatus: (["all", "noPdx", "admitted"] as const).includes(status as PendingStatus)
      ? (status as PendingStatus)
      : "all",
  };
}

/** กันการดึงทั้งตาราง: ต้องมีช่วงวัน หรือ AN/HN หรือเป็นแท็บรอสรุป */
export function hasScope(f: AdmissionFilter): boolean {
  return Boolean(f.admitFrom || f.admitTo || f.dischargeFrom || f.dischargeTo || f.q || f.pending);
}
