// app/api/course/route.ts — บันทึก Course in hospital ที่แพทย์แก้ไขแล้ว (ฐานข้อมูลแอป ไม่ใช่ HOSxP)
import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, HttpError, requireDecider } from "@/lib/api";
import { appDb } from "@/lib/appdb";
import { loadAdmission } from "@/lib/patients/load";

const Body = z.object({
  an: z.string().regex(/^[0-9]{1,15}$/),
  text: z.string().max(10_000),
  source: z.enum(["ai", "rules", "manual"]),
});

export async function PUT(req: Request) {
  try {
    const s = await requireDecider();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, "ข้อมูลไม่ถูกต้อง");
    await loadAdmission(parsed.data.an);
    const saved = await appDb().saveCourse({ ...parsed.data, updatedBy: s.username });
    await appDb().audit({ username: s.username, action: "course-save", an: parsed.data.an, detail: parsed.data.source });
    return NextResponse.json(saved);
  } catch (e) {
    return errorResponse(e, "course-save");
  }
}
