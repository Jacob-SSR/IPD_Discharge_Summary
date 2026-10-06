// app/api/patients/route.ts
// รายชื่อผู้ป่วยใน + ตัวกรอง (ช่วงวัน admit / จำหน่าย แยกกัน, แพทย์ 3 แบบ, หอผู้ป่วย, แท็บรอสรุป)
import { NextResponse } from "next/server";
import { errorResponse, HttpError, requireSession } from "@/lib/api";
import { hasScope, parseFilter } from "@/lib/patients/filter";
import { patientSource } from "@/lib/patients/source";

export async function GET(req: Request) {
  try {
    await requireSession();
    const filter = parseFilter(new URL(req.url).searchParams);
    if (!hasScope(filter)) throw new HttpError(400, "กรุณาเลือกช่วงวัน หรือค้นหาด้วย AN/HN");
    const rows = await patientSource().listAdmissions(filter);
    return NextResponse.json({ rows });
  } catch (e) {
    return errorResponse(e, "patients");
  }
}
