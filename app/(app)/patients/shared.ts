// ตัวช่วยแสดงผลของหน้าทำงาน (ใช้ร่วมกันหลาย component) — ข้อความ/ป้ายตามโปรแกรมเดิม
import { formatThaiDate } from "@/lib/date";
import type { OrType } from "@/lib/patients/types";

export const DT: Record<number, string> = { 1: "PDx", 2: "Comorbidity", 3: "Complication", 4: "Other", 5: "External cause" };
export const DT_TH: Record<number, string> = { 1: "การวินิจฉัยหลัก", 2: "โรคร่วม", 3: "โรคแทรกซ้อน", 4: "อื่น ๆ", 5: "สาเหตุภายนอก" };

export const thd = (iso: string | null | undefined) => (iso ? formatThaiDate(iso) : "-");
export const n4 = (v: number | null | undefined) => (v == null ? "-" : v.toFixed(4));
export const baht = (v: number, rate: number) => Math.round(v * rate).toLocaleString("th-TH");
export const orClass = (o: OrType | null | undefined) => (o === "OR" ? "or" : "nor");
export const orLabel = (o: OrType | null | undefined) => (o === "OR" ? "OR" : "Non-OR");
export const sexTh = (s: string) => (s === "M" ? "ชาย" : s === "F" ? "หญิง" : "-");
