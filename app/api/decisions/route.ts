// app/api/decisions/route.ts
// บันทึกการตัดสินใจทีละรหัส (ใคร/เมื่อไร/รหัส/ยอมรับหรือไม่) — ไม่มี endpoint "ยอมรับทั้งหมด" โดยตั้งใจ
//   accept / reject / undo : รหัสที่ระบบเสนอ (กดปุ่มเดิมซ้ำ = ยกเลิก)
//   add / remove           : รหัสที่แพทย์เพิ่มเอง
// PDx ได้ตัวเดียว: ยอมรับ/เพิ่ม PDx ใหม่ → ยกเลิกการยอมรับ PDx อื่น (แบบโปรแกรมเดิม)
import { NextResponse } from "next/server";
import { z } from "zod";
import { buildWorkspace } from "@/lib/ai";
import { fmt10, fmt9, itemKey, norm, systemOf } from "@/lib/ai/merge";
import type { MergedItem } from "@/lib/ai/types";
import { errorResponse, HttpError, requireDecider, requireSession } from "@/lib/api";
import { appDb } from "@/lib/appdb";
import type { DecisionSource, NewCodeDecision } from "@/lib/appdb/types";
import type { Session } from "@/lib/auth/session";
import { getCodebook, procClass } from "@/lib/coding/codebook";
import { isIsoDate } from "@/lib/date";
import { loadAdmission } from "@/lib/patients/load";
import { isValidAn, patientSource } from "@/lib/patients/source";
import type { DiagType } from "@/lib/patients/types";
import { workspaceBundle } from "@/lib/workspace";

const Judge = z.object({
  an: z.string(),
  op: z.enum(["accept", "reject", "undo"]),
  key: z.string().max(20),
});
const Add = z.object({
  an: z.string(),
  op: z.literal("add"),
  kind: z.enum(["dx", "proc"]),
  code: z.string().min(1).max(12),
  diagtype: z.number().int().min(1).max(5).nullable().optional(),
  orType: z.enum(["OR", "NonOR"]).nullable().optional(),
  opDate: z.string().nullable().optional(),
});
const Remove = z.object({ an: z.string(), op: z.literal("remove"), key: z.string().max(20) });
const Body = z.discriminatedUnion("op", [Judge, Add, Remove]);

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

const sourceOf = (it: MergedItem): DecisionSource => (it.source === "manual" ? "manual" : it.source === "rule" ? "rules" : "ai");

function base(an: string, it: Pick<MergedItem, "kind" | "code">, s: Session): Pick<NewCodeDecision, "an" | "code" | "system" | "decidedBy"> {
  return { an, code: it.code, system: systemOf(it.kind), decidedBy: s.username };
}

export async function POST(req: Request) {
  try {
    const s = await requireDecider();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, "ข้อมูลไม่ถูกต้อง");
    const b = parsed.data;
    const a = await loadAdmission(b.an);
    const ws = await buildWorkspace(a, patientSource());
    const db = appDb();
    const aiRun = ws.aiRun;
    const run = ws.run;

    const judge = (it: MergedItem, action: "accept" | "reject" | "undo") =>
      db.addDecision({
        ...base(a.an, it, s),
        source: sourceOf(it),
        action,
        diagtype: it.kind === "dx" && it.diagtype ? (String(it.diagtype) as DiagType) : null,
        orType: it.kind === "proc" ? it.procClass : null,
        opDate: null,
        provider: it.source === "rule" ? (run?.provider ?? "rules") : (aiRun?.provider ?? null),
        model: it.source === "rule" ? null : (aiRun?.model ?? null),
        aiRunId: it.source === "rule" ? (run?.runId ?? null) : (aiRun?.runId ?? null),
      });
    const removeManual = (it: MergedItem) =>
      db.addDecision({
        ...base(a.an, it, s),
        source: "manual",
        action: "remove",
        diagtype: null,
        orType: null,
        opDate: null,
        provider: null,
        model: null,
        aiRunId: null,
      });
    /** PDx ได้ตัวเดียว */
    const clearOtherPdx = async (exceptKey: string) => {
      for (const it of ws.items) {
        if (it.key === exceptKey || it.kind !== "dx" || it.diagtype !== 1) continue;
        if (it.source === "manual") await removeManual(it);
        else if (ws.state[it.key] === "accepted") await judge(it, "undo");
      }
    };

    if (b.op === "accept" || b.op === "reject" || b.op === "undo") {
      const it = ws.items.find((x) => x.key === b.key);
      if (!it || it.source === "manual") throw new HttpError(409, "ข้อเสนอมีการเปลี่ยนแปลง กรุณาโหลดใหม่");
      if (it.already) throw new HttpError(400, "รหัสนี้ลงไว้แล้วใน HOSxP");
      if (b.op === "accept" && it.kind === "dx" && it.diagtype === 1) await clearOtherPdx(it.key);
      await judge(it, b.op);
      await db.audit({ username: s.username, action: `suggestion-${b.op}`, an: a.an, detail: `${systemOf(it.kind)} ${it.code}` });
    } else if (b.op === "remove") {
      const it = ws.items.find((x) => x.key === b.key && x.source === "manual");
      if (!it) throw new HttpError(404, "ไม่พบรหัสที่เพิ่มเอง");
      await removeManual(it);
      await db.audit({ username: s.username, action: "code-remove", an: a.an, detail: `${systemOf(it.kind)} ${it.code}` });
    } else if (b.op === "add") {
      const n = norm(b.code);
      const dx = b.kind === "dx";
      if (!(dx ? /^[A-Z]\d\d[0-9A-Z]{0,3}$/ : /^\d{2,4}$/).test(n)) {
        throw new HttpError(400, "ไม่พบรหัส — ลองพิมพ์รหัส (เช่น E87.1, 96.71) หรือชื่อภาษาอังกฤษ");
      }
      const have = dx ? a.diagnoses.map((d) => norm(d.icd10)) : a.procedures.map((p) => norm(p.icd9));
      const book = getCodebook(dx ? "ICD10" : "ICD9CM");
      const code = book.get(dx ? fmt10(n) : fmt9(n))?.code ?? (dx ? fmt10(n) : fmt9(n));
      if (have.includes(n)) throw new HttpError(409, `รหัส ${code} ลงไว้แล้วใน HOSxP`);
      if (dx && !b.diagtype) throw new HttpError(400, "กรุณาเลือกประเภทการวินิจฉัย");
      if (b.opDate && !isIsoDate(b.opDate)) throw new HttpError(400, "วันที่ทำหัตถการไม่ถูกต้อง");
      const key = itemKey(b.kind, code);
      if (dx && b.diagtype === 1) await clearOtherPdx(key);
      await db.addDecision({
        ...base(a.an, { kind: b.kind, code }, s),
        source: "manual",
        action: "add",
        diagtype: dx ? (String(b.diagtype) as DiagType) : null,
        orType: dx ? null : (b.orType ?? procClass(code)),
        opDate: dx ? null : (b.opDate ?? null),
        provider: null,
        model: null,
        aiRunId: null,
      });
      await db.audit({ username: s.username, action: "code-add", an: a.an, detail: `${systemOf(b.kind)} ${code}` });
    }
    return NextResponse.json(await workspaceBundle(a, s));
  } catch (e) {
    return errorResponse(e, "decisions");
  }
}
