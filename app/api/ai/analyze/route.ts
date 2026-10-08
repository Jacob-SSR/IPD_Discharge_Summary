// app/api/ai/analyze/route.ts
// ปุ่ม "วิเคราะห์ด้วย AI" / "ให้ AI ร่างรหัส" — เรียก AI จากฝั่ง server เท่านั้น ข้อมูลผ่าน deidentify ใน lib/ai เสมอ
import { NextResponse } from "next/server";
import { z } from "zod";
import { runAnalyze } from "@/lib/ai";
import { errorResponse, HttpError, requireDecider } from "@/lib/api";
import { appDb } from "@/lib/appdb";
import { clientIp, rateLimit } from "@/lib/auth/rateLimit";
import { loadAdmission } from "@/lib/patients/load";
import { workspaceBundle } from "@/lib/workspace";

const Body = z.object({ an: z.string().regex(/^[0-9]{1,15}$/) });

export async function POST(req: Request) {
  try {
    const s = await requireDecider();
    const limit = await rateLimit(`ai:${s.username}:${clientIp(req)}`, 30, 10 * 60_000);
    if (!limit.ok) throw new HttpError(429, "เรียก AI บ่อยเกินไป กรุณารอสักครู่");
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, "AN ไม่ถูกต้อง");
    const admission = await loadAdmission(parsed.data.an);
    const course = await appDb().getCourse(admission.an);
    const result = await runAnalyze(admission, s.username, course?.text);
    await appDb().audit({
      username: s.username,
      action: "ai-analyze",
      an: admission.an,
      detail: `${result.provider}${result.model ? "/" + result.model : ""} n=${result.items.length}`,
    });
    return NextResponse.json(await workspaceBundle(admission, s));
  } catch (e) {
    return errorResponse(e, "ai-analyze");
  }
}
