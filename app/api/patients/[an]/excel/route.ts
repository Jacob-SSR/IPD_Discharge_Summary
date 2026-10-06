// app/api/patients/[an]/excel/route.ts — Export Excel ของแบบฟอร์ม Discharge Summary
import { latestSuggest } from "@/lib/ai";
import { errorResponse, requireSession } from "@/lib/api";
import { appDb } from "@/lib/appdb";
import { buildFinalCodes } from "@/lib/coding/final";
import { hospitalName } from "@/lib/env";
import { dischargeSummaryWorkbook } from "@/lib/export/excel";
import { loadAdmission } from "@/lib/patients/load";
import { getCodebook } from "@/lib/coding/codebook";

export async function GET(_req: Request, ctx: RouteContext<"/api/patients/[an]/excel">) {
  try {
    const s = await requireSession();
    const { an } = await ctx.params;
    const a = await loadAdmission(an);
    const db = appDb();
    const [decisions, course, suggest] = await Promise.all([db.listDecisions(an), db.getCourse(an), latestSuggest(an)]);
    const suggestedName = new Map(suggest?.suggestions.map((x) => [`${x.system}:${x.code}`, x.description]) ?? []);
    const codes = buildFinalCodes(a, decisions).map((c) => ({
      ...c,
      name: c.name ?? getCodebook(c.system).get(c.code)?.description ?? suggestedName.get(`${c.system}:${c.code}`) ?? null,
    }));
    const buf = await dischargeSummaryWorkbook(a, codes, course, hospitalName());
    await db.audit({ username: s.username, action: "export-excel", an, detail: null });
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="discharge-summary-${an}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return errorResponse(e, "export-excel");
  }
}
