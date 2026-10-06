// app/api/coding/check/route.ts
// ตรวจชุดรหัสสุดท้ายตามกฎ (MB1–MB5, dagger/asterisk, sequelae, external cause, codebook)
// + ค่าประมาณ RW ก่อน/หลังยืนยันรหัส
import { NextResponse } from "next/server";
import { z } from "zod";
import { latestSuggest } from "@/lib/ai";
import { errorResponse, HttpError, requireSession } from "@/lib/api";
import { appDb } from "@/lib/appdb";
import { checkCodeSet } from "@/lib/coding/checks";
import { getCodebook } from "@/lib/coding/codebook";
import { buildFinalCodes } from "@/lib/coding/final";
import { estimateForCodes } from "@/lib/drg/caseEstimate";
import { loadAdmission } from "@/lib/patients/load";
import { patientSource } from "@/lib/patients/source";

const Body = z.object({ an: z.string().regex(/^[0-9]{1,15}$/) });

export async function POST(req: Request) {
  try {
    await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, "AN ไม่ถูกต้อง");
    const a = await loadAdmission(parsed.data.an);
    const [decisions, suggest] = await Promise.all([appDb().listDecisions(a.an), latestSuggest(a.an)]);
    const original = buildFinalCodes(a, []);
    // ชื่อรหัส: HOSxP → codebook → คำอธิบายจากข้อเสนอ (กรณียังไม่มี codebook)
    const suggestedName = new Map(suggest?.suggestions.map((x) => [`${x.system}:${x.code}`, x.description]) ?? []);
    const final = buildFinalCodes(a, decisions).map((c) => ({
      ...c,
      name: c.name ?? getCodebook(c.system).get(c.code)?.description ?? suggestedName.get(`${c.system}:${c.code}`) ?? null,
    }));
    const issues = checkCodeSet({
      diagnoses: final.filter((c) => c.system === "ICD10").map((c) => ({ code: c.code, diagtype: c.diagtype ?? "4" })),
      procedures: final.filter((c) => c.system === "ICD9CM").map((c) => ({ code: c.code })),
    });
    const src = patientSource();
    const [before, after] = await Promise.all([
      estimateForCodes(src, original, a.los),
      estimateForCodes(src, final, a.los),
    ]);
    return NextResponse.json({ final, issues, estimate: { before, after } });
  } catch (e) {
    return errorResponse(e, "coding-check");
  }
}
