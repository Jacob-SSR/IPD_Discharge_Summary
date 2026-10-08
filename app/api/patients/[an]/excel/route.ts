// app/api/patients/[an]/excel/route.ts — Export Excel ของแบบฟอร์ม Discharge Summary (รหัส HOSxP + รหัสที่แพทย์ยืนยัน)
import { buildWorkspace } from "@/lib/ai";
import { acceptedItems } from "@/lib/ai/merge";
import { errorResponse, requireSession } from "@/lib/api";
import { appDb } from "@/lib/appdb";
import { finalCodes } from "@/lib/coding/final";
import { valOf } from "@/lib/drg/estimate";
import { hospitalName } from "@/lib/env";
import { dischargeSummaryWorkbook } from "@/lib/export/excel";
import { loadAdmission } from "@/lib/patients/load";
import { patientSource } from "@/lib/patients/source";

const n4 = (v: number | null | undefined) => (v == null ? "-" : v.toFixed(4));

export async function GET(_req: Request, ctx: RouteContext<"/api/patients/[an]/excel">) {
  try {
    const s = await requireSession();
    const { an } = await ctx.params;
    const a = await loadAdmission(an);
    const ws = await buildWorkspace(a, patientSource());
    const acc = acceptedItems(ws.items, new Map(Object.entries(ws.state)));
    const est = ws.rw.after ?? ws.rw.before;
    const drgLine =
      a.rw != null && !acc.length
        ? `${a.drg ?? "-"} / ${n4(a.rw)} / ${n4(a.adjrw)} (HOSxP)`
        : est
          ? `${est.drg} / ${n4(est.rw)} / ${n4(est.adjrw)} (ประมาณ · ${n4(valOf(est))})`
          : "-";
    const buf = await dischargeSummaryWorkbook(a, finalCodes(a, acc), ws.course, hospitalName(), drgLine);
    await appDb().audit({ username: s.username, action: "export-excel", an, detail: null });
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
