// app/api/ai/course/route.ts
// ร่าง Course in hospital จากข้อมูลมีโครงสร้าง (ไม่ส่ง free text) — แพทย์แก้ไขก่อนบันทึก
import { NextResponse } from "next/server";
import { z } from "zod";
import { runCourse } from "@/lib/ai";
import { errorResponse, HttpError, requireDecider } from "@/lib/api";
import { appDb } from "@/lib/appdb";
import { clientIp, rateLimit } from "@/lib/auth/rateLimit";
import { loadAdmission } from "@/lib/patients/load";

const Body = z.object({ an: z.string().regex(/^[0-9]{1,15}$/) });

export async function POST(req: Request) {
  try {
    const s = await requireDecider();
    const limit = await rateLimit(`ai:${s.username}:${clientIp(req)}`, 30, 10 * 60_000);
    if (!limit.ok) throw new HttpError(429, "เรียก AI บ่อยเกินไป กรุณารอสักครู่");
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, "AN ไม่ถูกต้อง");
    const admission = await loadAdmission(parsed.data.an);
    const result = await runCourse(admission, s.username);
    await appDb().audit({ username: s.username, action: "ai-course", an: admission.an, detail: result.provider });
    return NextResponse.json(result);
  } catch (e) {
    return errorResponse(e, "ai-course");
  }
}
