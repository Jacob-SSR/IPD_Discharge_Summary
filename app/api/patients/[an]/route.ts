// app/api/patients/[an]/route.ts
// ข้อมูลทั้งหมดของหน้า Discharge Summary ราย AN: เวชระเบียน + สิ่งที่บันทึกไว้ในฐานข้อมูลแอป
import { NextResponse } from "next/server";
import { aiStatus, latestSuggest } from "@/lib/ai";
import { errorResponse, requireSession } from "@/lib/api";
import { appDb } from "@/lib/appdb";
import { canDecide } from "@/lib/auth/session";
import { getCodebook } from "@/lib/coding/codebook";
import { getTdrgTables } from "@/lib/drg/tables";
import { ADJRW_FORMULA_VERIFIED } from "@/lib/drg/adjrw";
import { hospitalName } from "@/lib/env";
import { loadAdmission } from "@/lib/patients/load";

export async function GET(_req: Request, ctx: RouteContext<"/api/patients/[an]">) {
  try {
    const session = await requireSession();
    const { an } = await ctx.params;
    const admission = await loadAdmission(an);
    const db = appDb();
    const [course, decisions, suggest] = await Promise.all([
      db.getCourse(an),
      db.listDecisions(an),
      latestSuggest(an),
    ]);
    const icd10 = getCodebook("ICD10");
    const icd9 = getCodebook("ICD9CM");
    const tdrg = getTdrgTables();
    return NextResponse.json({
      admission,
      course,
      decisions,
      suggest,
      ai: aiStatus(),
      canDecide: canDecide(session),
      hospitalName: hospitalName(),
      reference: {
        icd10: { source: icd10.source, isDemo: icd10.isDemo, size: icd10.size },
        icd9: { source: icd9.source, isDemo: icd9.isDemo, size: icd9.size },
        tdrg: { source: tdrg.source, isDemo: tdrg.isDemo, size: tdrg.rw.size, formulaVerified: ADJRW_FORMULA_VERIFIED },
      },
    });
  } catch (e) {
    return errorResponse(e, "patient-detail");
  }
}
