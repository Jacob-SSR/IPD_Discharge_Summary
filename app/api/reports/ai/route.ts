// app/api/reports/ai/route.ts — ผลงาน AI (จากฐานข้อมูลแอป)
import { NextResponse } from "next/server";
import { errorResponse, requireSession } from "@/lib/api";
import { patientSource } from "@/lib/patients/source";
import { buildAiReport } from "@/lib/reports/ai";
import { reportRange } from "@/lib/reports/range";

export async function GET(req: Request) {
  try {
    await requireSession();
    const { from, to } = reportRange(new URL(req.url).searchParams);
    return NextResponse.json(await buildAiReport(patientSource(), from, to));
  } catch (e) {
    return errorResponse(e, "report-ai");
  }
}
