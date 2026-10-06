// app/api/reports/ai/route.ts — ผลงาน AI (จากฐานข้อมูลแอป)
import { NextResponse } from "next/server";
import { errorResponse, requireSession } from "@/lib/api";
import { appDb } from "@/lib/appdb";
import { patientSource } from "@/lib/patients/source";
import { buildAiReport } from "@/lib/reports/ai";
import { reportRange } from "@/lib/reports/range";

export async function GET(req: Request) {
  try {
    await requireSession();
    const { from, to } = reportRange(new URL(req.url).searchParams);
    const db = appDb();
    const [runs, decisions] = await Promise.all([db.listAiRunsInRange(from, to), db.listDecisionsInRange(from, to)]);
    const report = await buildAiReport(runs, decisions, patientSource(), from, to, (an) => db.listDecisions(an));
    return NextResponse.json(report);
  } catch (e) {
    return errorResponse(e, "report-ai");
  }
}
