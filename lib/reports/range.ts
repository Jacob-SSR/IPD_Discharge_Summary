// lib/reports/range.ts — อ่านช่วงวันที่ของรายงานจาก query string (ค่าเริ่มต้น = ปีงบนี้)
import { fiscalYearBE, fiscalYearRange, isIsoDate, todayIso } from "@/lib/date";
import { HttpError } from "@/lib/api";

export function reportRange(sp: URLSearchParams): { from: string; to: string } {
  const today = todayIso();
  const from = sp.get("from") ?? fiscalYearRange(fiscalYearBE(today)).from;
  const to = sp.get("to") ?? today;
  if (!isIsoDate(from) || !isIsoDate(to) || from > to) throw new HttpError(400, "ช่วงวันที่ไม่ถูกต้อง");
  return { from, to };
}
