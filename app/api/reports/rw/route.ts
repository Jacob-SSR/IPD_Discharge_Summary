// app/api/reports/rw/route.ts — รายงาน RW/CMI (RW จริงจาก an_stat)
import { NextResponse } from "next/server";
import { errorResponse, requireSession } from "@/lib/api";
import { patientSource } from "@/lib/patients/source";
import { reportRange } from "@/lib/reports/range";
import { buildRwReport } from "@/lib/reports/rw";

export async function GET(req: Request) {
  try {
    await requireSession();
    const { from, to } = reportRange(new URL(req.url).searchParams);
    const rows = await patientSource().rwRows(from, to);
    return NextResponse.json(buildRwReport(rows, from, to));
  } catch (e) {
    return errorResponse(e, "report-rw");
  }
}
