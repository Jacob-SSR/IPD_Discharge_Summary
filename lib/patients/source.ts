// lib/patients/source.ts
// เลือกแหล่งข้อมูลตาม APP_MODE: demo = ข้อมูลสมมติ, hosxp = HOSxP จริง (อ่านอย่างเดียว)
// โหมด hosxp ใส่ cache สั้นๆ กันยิงซ้ำ — หน้าจอไม่ต้องรู้ว่าข้อมูลมาจากไหน

import { cachedQuery } from "@/lib/cache";
import { demoSource } from "@/lib/demo/source";
import { appMode } from "@/lib/env";
import {
  fetchAdmission,
  fetchAdmissions,
  fetchFilterOptions,
  fetchHistoricalGroups,
  fetchRwRows,
} from "@/lib/hosxp/queries";
import type { PatientSource } from "./types";

const hosxpSource: PatientSource = {
  kind: "hosxp",
  listAdmissions: (f) =>
    cachedQuery(["list", JSON.stringify(f)], () => fetchAdmissions(f), 60),
  getAdmission: (an) => cachedQuery(["patient", an], () => fetchAdmission(an), 60),
  filterOptions: () => cachedQuery(["filter-options"], fetchFilterOptions, 3600),
  historicalGroups: (pdx, from, to) =>
    cachedQuery(["hist", pdx, from, to], () => fetchHistoricalGroups(pdx, from, to), 86400),
  rwRows: (from, to) => cachedQuery(["rw", from, to], () => fetchRwRows(from, to), 600),
};

export function patientSource(): PatientSource {
  return appMode() === "demo" ? demoSource : hosxpSource;
}

/** AN ของ HOSxP เป็นตัวเลข — กันค่าที่แปลกปลอมก่อนเข้า query */
export function isValidAn(an: string): boolean {
  return /^[0-9]{1,15}$/.test(an);
}
