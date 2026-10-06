// lib/date.ts
// วันที่ในระบบเก็บเป็น ISO "YYYY-MM-DD" (ค.ศ.) แล้วแปลงเป็น พ.ศ. ตอนแสดงผลเท่านั้น
// คำนวณด้วย UTC ล้วน กันวันเลื่อนจาก timezone ของเครื่อง

const TH_MONTHS_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];
const TH_MONTHS_LONG = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

const DAY_MS = 86_400_000;
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isIsoDate(s: unknown): s is string {
  if (typeof s !== "string") return false;
  const m = ISO_RE.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

function parts(iso: string): [number, number, number] {
  const m = ISO_RE.exec(iso);
  if (!m) throw new Error(`วันที่ไม่ถูกรูปแบบ: ${iso}`);
  return [+m[1], +m[2], +m[3]];
}

function toUtc(iso: string): number {
  const [y, mo, d] = parts(iso);
  return Date.UTC(y, mo - 1, d);
}

function fromUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** วันนี้ตามเวลาท้องถิ่นของเครื่อง (server ตั้ง TZ=Asia/Bangkok) */
export function todayIso(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(iso: string, days: number): string {
  return fromUtc(toUtc(iso) + days * DAY_MS);
}

/** จำนวนวันจาก a ถึง b (b - a) */
export function daysBetween(a: string, b: string): number {
  return Math.round((toUtc(b) - toUtc(a)) / DAY_MS);
}

/** แปลง Date/สตริงจาก DB ให้เป็น ISO "YYYY-MM-DD" (null ถ้าว่าง/ไม่ถูกต้อง) */
export function normalizeDate(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null;
    return todayIso(v);
  }
  const s = String(v).slice(0, 10);
  return isIsoDate(s) ? s : null;
}

// ── แสดงผลแบบ พ.ศ. ──────────────────────────────────────────────────────────
export function beYear(iso: string): number {
  return parts(iso)[0] + 543;
}

/** "6 ต.ค. 2569" */
export function formatThaiDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  const [y, m, d] = parts(iso);
  return `${d} ${TH_MONTHS_SHORT[m - 1]} ${y + 543}`;
}

/** "6 ตุลาคม 2569" */
export function formatThaiDateLong(iso: string | null | undefined): string {
  if (!iso) return "-";
  const [y, m, d] = parts(iso);
  return `${d} ${TH_MONTHS_LONG[m - 1]} ${y + 543}`;
}

/** "06/10/2569" */
export function formatThaiDateNumeric(iso: string | null | undefined): string {
  if (!iso) return "-";
  const [y, m, d] = parts(iso);
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y + 543}`;
}

/** "ต.ค. 2569" */
export function formatThaiMonth(yearMonth: string): string {
  const [y, m] = yearMonth.split("-").map(Number);
  return `${TH_MONTHS_SHORT[m - 1]} ${y + 543}`;
}

/** "08:30" จาก "08:30:00" */
export function formatTime(t: string | null | undefined): string {
  if (!t) return "";
  return String(t).slice(0, 5);
}

// ── ปีงบประมาณ (เริ่ม 1 ต.ค.) ────────────────────────────────────────────────
/** ปีงบประมาณ พ.ศ. ของวันที่ — 1 ต.ค. 2568 อยู่ในปีงบ 2569 */
export function fiscalYearBE(iso: string): number {
  const [y, m] = parts(iso);
  return (m >= 10 ? y + 1 : y) + 543;
}

export function fiscalYearRange(fyBE: number): { from: string; to: string } {
  const ce = fyBE - 543;
  return { from: `${ce - 1}-10-01`, to: `${ce}-09-30` };
}

// ── ช่วงด่วน ────────────────────────────────────────────────────────────────
export const QUICK_RANGES = [
  { key: "today", label: "วันนี้" },
  { key: "yesterday", label: "เมื่อวาน" },
  { key: "last7", label: "7 วันล่าสุด" },
  { key: "thisMonth", label: "เดือนนี้" },
  { key: "lastMonth", label: "เดือนที่แล้ว" },
  { key: "thisFiscalYear", label: "ปีงบนี้" },
] as const;

export type QuickRangeKey = (typeof QUICK_RANGES)[number]["key"];

export function quickRange(key: QuickRangeKey, today: string): { from: string; to: string } {
  const [y, m] = parts(today);
  switch (key) {
    case "today":
      return { from: today, to: today };
    case "yesterday": {
      const d = addDays(today, -1);
      return { from: d, to: d };
    }
    case "last7":
      return { from: addDays(today, -6), to: today };
    case "thisMonth":
      return { from: `${y}-${String(m).padStart(2, "0")}-01`, to: today };
    case "lastMonth": {
      const firstThis = `${y}-${String(m).padStart(2, "0")}-01`;
      const lastPrev = addDays(firstThis, -1);
      return { from: `${lastPrev.slice(0, 7)}-01`, to: lastPrev };
    }
    case "thisFiscalYear":
      return { from: fiscalYearRange(fiscalYearBE(today)).from, to: today };
  }
}
