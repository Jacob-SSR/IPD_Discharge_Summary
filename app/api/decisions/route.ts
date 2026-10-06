// app/api/decisions/route.ts
// บันทึกการตัดสินใจทีละรหัส (ใคร/เมื่อไร/รหัส/ยอมรับหรือไม่) — ไม่มี endpoint "ยอมรับทั้งหมด" โดยตั้งใจ
import { NextResponse } from "next/server";
import { z } from "zod";
import { latestSuggest } from "@/lib/ai";
import { errorResponse, HttpError, requireDecider, requireSession } from "@/lib/api";
import { appDb } from "@/lib/appdb";
import { isValidFormat, normalizeCode } from "@/lib/coding/icd";
import { isIsoDate } from "@/lib/date";
import { isValidAn } from "@/lib/patients/source";
import { loadAdmission } from "@/lib/patients/load";

const Suggested = z.object({
  an: z.string(),
  source: z.enum(["ai", "rules"]),
  action: z.enum(["accept", "reject"]),
  system: z.enum(["ICD10", "ICD9CM"]),
  code: z.string().max(10),
  aiRunId: z.number().int(),
});

const Manual = z.object({
  an: z.string(),
  source: z.literal("manual"),
  action: z.enum(["add", "remove"]),
  system: z.enum(["ICD10", "ICD9CM"]),
  code: z.string().max(10),
  diagtype: z.enum(["1", "2", "3", "4", "5"]).nullable().optional(),
  orType: z.enum(["OR", "NonOR"]).nullable().optional(),
  opDate: z.string().nullable().optional(),
});

const Body = z.discriminatedUnion("source", [Suggested, Manual]);

export async function GET(req: Request) {
  try {
    await requireSession();
    const an = new URL(req.url).searchParams.get("an") ?? "";
    if (!isValidAn(an)) throw new HttpError(400, "AN ไม่ถูกต้อง");
    return NextResponse.json({ decisions: await appDb().listDecisions(an) });
  } catch (e) {
    return errorResponse(e, "decisions-list");
  }
}

export async function POST(req: Request) {
  try {
    const s = await requireDecider();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, "ข้อมูลไม่ถูกต้อง");
    const b = parsed.data;
    await loadAdmission(b.an);
    const code = normalizeCode(b.system, b.code);
    const db = appDb();

    if (b.source === "manual") {
      if (!isValidFormat(b.system, code)) throw new HttpError(400, `รูปแบบรหัส ${code} ไม่ถูกต้อง`);
      if (b.action === "add" && b.system === "ICD10" && !b.diagtype) throw new HttpError(400, "กรุณาเลือกประเภทการวินิจฉัย");
      if (b.action === "add" && b.system === "ICD9CM" && !b.orType) throw new HttpError(400, "กรุณาเลือก OR / Non-OR");
      if (b.opDate && !isIsoDate(b.opDate)) throw new HttpError(400, "วันที่ทำหัตถการไม่ถูกต้อง");
      const rec = await db.addDecision({
        an: b.an,
        code,
        system: b.system,
        source: "manual",
        action: b.action,
        diagtype: b.system === "ICD10" ? (b.diagtype ?? null) : null,
        orType: b.system === "ICD9CM" ? (b.orType ?? null) : null,
        opDate: b.system === "ICD9CM" ? (b.opDate ?? null) : null,
        provider: null,
        model: null,
        aiRunId: null,
        decidedBy: s.username,
      });
      await db.audit({ username: s.username, action: `code-${b.action}`, an: b.an, detail: `${b.system} ${code}` });
      return NextResponse.json(rec);
    }

    // รหัสจากข้อเสนอ: ต้องตรงกับผลครั้งล่าสุดของ AN นี้
    const run = await latestSuggest(b.an);
    if (!run || run.runId !== b.aiRunId) throw new HttpError(409, "ข้อเสนอมีการเปลี่ยนแปลง กรุณาโหลดหน้าใหม่");
    const sug = run.suggestions.find((x) => x.system === b.system && x.code === code);
    if (!sug) throw new HttpError(400, "ไม่พบรหัสนี้ในข้อเสนอ");
    const rec = await db.addDecision({
      an: b.an,
      code,
      system: b.system,
      source: run.provider === "gemini" ? "ai" : "rules",
      action: b.action,
      diagtype: sug.diagtype,
      orType: sug.orType,
      opDate: null,
      provider: run.provider,
      model: run.model,
      aiRunId: run.runId,
      decidedBy: s.username,
    });
    await db.audit({ username: s.username, action: `suggestion-${b.action}`, an: b.an, detail: `${b.system} ${code}` });
    return NextResponse.json(rec);
  } catch (e) {
    return errorResponse(e, "decisions");
  }
}
