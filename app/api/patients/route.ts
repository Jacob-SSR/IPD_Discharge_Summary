// app/api/patients/route.ts
// รายชื่อด้านซ้ายของหน้าทำงาน: "รอสรุป · ยังไม่ลง PDx" (ทุกรายที่ยังไม่มี PDx ใน 1 ปี) + "ลงรหัสแล้ว" ตามตัวกรอง
// พร้อมจุดสถานะ: ผลตรวจกฎ (chartLevel) และเคยวิเคราะห์ด้วย AI แล้วหรือยัง
import { NextResponse } from "next/server";
import { errorResponse, requireSession } from "@/lib/api";
import { appDb } from "@/lib/appdb";
import { chartLevel } from "@/lib/coding/legacyRules";
import type { ListItem } from "@/lib/patients/bundle";
import { hasScope, parseFilter } from "@/lib/patients/filter";
import { patientSource } from "@/lib/patients/source";
import type { AdmissionRow } from "@/lib/patients/types";

export async function GET(req: Request) {
  try {
    await requireSession();
    const filter = parseFilter(new URL(req.url).searchParams);
    const src = patientSource();
    const [pending, coded] = await Promise.all([
      // รอสรุปไม่จำกัดช่วงวัน (รวมรายที่ยังนอนอยู่) — query ของ HOSxP จำกัด 1 ปีล่าสุดให้เอง
      src.listAdmissions({
        ...filter,
        admitFrom: undefined,
        admitTo: undefined,
        dischargeFrom: undefined,
        dischargeTo: undefined,
        pending: true,
        pendingStatus: "noPdx",
      }),
      hasScope({ ...filter, pending: false }) ? src.listAdmissions({ ...filter, pending: false }) : Promise.resolve([]),
    ]);
    const rows = new Map<string, AdmissionRow>();
    for (const r of [...pending, ...coded]) rows.set(r.an, r);
    const ans = [...rows.keys()];
    const [coding, ran] = await Promise.all([src.codingOf(ans), appDb().ansWithAiRuns(ans)]);
    const items: ListItem[] = [...rows.values()].map((r) => {
      const c = coding[r.an] ?? { diagnoses: [], procedures: [] };
      const diagnoses = c.diagnoses.map((d) => ({ ...d, name: null, doctorName: null }));
      const procedures = c.procedures.map((p) => ({ ...p, name: null, opDate: null, doctorCode: null, doctorName: null }));
      const level = chartLevel({ diagnoses, procedures, los: r.los, dischargeDate: r.dischargeDate, dischargeType: r.dischargeType });
      return { ...r, pending: !diagnoses.some((d) => d.diagtype === "1"), level, aiRan: ran.has(r.an) };
    });
    return NextResponse.json({ items });
  } catch (e) {
    return errorResponse(e, "patients");
  }
}
