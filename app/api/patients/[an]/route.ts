// app/api/patients/[an]/route.ts
// ข้อมูลทั้งหน้าของผู้ป่วยหนึ่งราย: ชาร์ต + ข้อเสนอรหัส (กฎ + AI ครั้งล่าสุด + แพทย์เพิ่ม) + DRG/RW
import { NextResponse } from "next/server";
import { errorResponse, requireSession } from "@/lib/api";
import { loadAdmission } from "@/lib/patients/load";
import { workspaceBundle } from "@/lib/workspace";

export async function GET(_req: Request, ctx: RouteContext<"/api/patients/[an]">) {
  try {
    const session = await requireSession();
    const { an } = await ctx.params;
    return NextResponse.json(await workspaceBundle(await loadAdmission(an), session));
  } catch (e) {
    return errorResponse(e, "patient-detail");
  }
}
