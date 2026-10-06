// app/api/patients/options/route.ts — ตัวเลือกหอผู้ป่วย/แพทย์ สำหรับตัวกรอง
import { NextResponse } from "next/server";
import { errorResponse, requireSession } from "@/lib/api";
import { patientSource } from "@/lib/patients/source";

export async function GET() {
  try {
    await requireSession();
    return NextResponse.json(await patientSource().filterOptions());
  } catch (e) {
    return errorResponse(e, "patient-options");
  }
}
