// app/api/tally/route.ts — ตัวเลขหัวหน้าทำงาน (วิเคราะห์แล้ว / ยอมรับ / ไม่ยอมรับ / อัตรายอมรับ / RW จาก AI) ปีงบประมาณปัจจุบัน
import { NextResponse } from "next/server";
import { errorResponse, requireSession } from "@/lib/api";
import { fiscalYearBE, fiscalYearRange, todayIso } from "@/lib/date";
import { patientSource } from "@/lib/patients/source";
import { buildTally } from "@/lib/reports/ai";

export async function GET() {
  try {
    await requireSession();
    const today = todayIso();
    const { from } = fiscalYearRange(fiscalYearBE(today));
    return NextResponse.json(await buildTally(patientSource(), from, today));
  } catch (e) {
    return errorResponse(e, "tally");
  }
}
