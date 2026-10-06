// app/api/ai/suggest/route.ts
// ขอคำแนะนำรหัส — เรียก AI จากฝั่ง server เท่านั้น ข้อมูลผ่าน deidentify ใน lib/ai เสมอ
import { NextResponse } from "next/server";
import { z } from "zod";
import { runSuggest } from "@/lib/ai";
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
    const result = await runSuggest(admission, s.username);
    await appDb().audit({
      username: s.username,
      action: "ai-suggest",
      an: admission.an,
      detail: `${result.provider}${result.model ? "/" + result.model : ""} n=${result.suggestions.length}`,
    });
    return NextResponse.json(result);
  } catch (e) {
    return errorResponse(e, "ai-suggest");
  }
}
