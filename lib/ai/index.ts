// lib/ai/index.ts
// เลือก provider จาก env AI_PROVIDER = gemini | rules และควบคุมเงื่อนไขความปลอดภัย:
//   - ข้อความที่ส่ง AI สร้างจาก deidentify() + buildPrompt() แล้วตรวจซ้ำด้วย assertNoIdentifiers() ทุกครั้ง
//   - โหมด hosxp ต้องมี GEMINI_PAID_TIER=true ถึงจะส่ง Gemini ได้ (ห้ามใช้ free tier กับข้อมูลผู้ป่วย)
//   - Gemini ตอบผิด schema/ล้ม → retry ได้ 1 ครั้ง แล้ว fallback เป็นกฎหลักฐาน (rules)
//   - เก็บ ai_runs เฉพาะผลลัพธ์ (ไม่มีข้อมูลระบุตัวตน) — ไม่เก็บ prompt

import { appDb } from "@/lib/appdb";
import type { AiRun, CodeDecision, CourseText } from "@/lib/appdb/types";
import { getCodebook, procClass } from "@/lib/coding/codebook";
import { chartAlerts, chartLevel, ruleHints, type ChartAlert, type ChartLevel, type RuleHint } from "@/lib/coding/legacyRules";
import { addDays, fiscalYearBE, fiscalYearRange, todayIso } from "@/lib/date";
import { rwPdx, rwState, type RwState } from "@/lib/drg/rwState";
import { getTdrgTables } from "@/lib/drg/tables";
import {
  aiProviderName,
  aiTimeoutMs,
  appMode,
  geminiApiKey,
  geminiModel,
  geminiPaidTier,
} from "@/lib/env";
import type { AdmissionDetail, GroupingHistory, PatientSource } from "@/lib/patients/types";
import { assertNoIdentifiers, DeidentificationError, deidentify } from "./deidentify";
import { createGeminiProvider, geminiGenerateFn } from "./gemini";
import { acceptedItems, decisionView, evidenceMatcher, merge, type BookLookup, type DecisionState } from "./merge";
import { buildPrompt } from "./prompt";
import type { AiAnalysis, AiProvider, AnalyzeResult, MergedItem } from "./types";

export interface AiStatus {
  configured: "gemini" | "rules";
  active: "gemini" | "rules";
  model: string | null;
  paidTier: boolean;
  mode: "demo" | "hosxp";
  /** เหตุผลที่ใช้ได้เฉพาะกฎหลักฐาน (ถ้ามี) */
  reason: string | null;
}

let testProvider: AiProvider | null = null;
/** สำหรับ test เท่านั้น: ใส่ provider จำลองแทน Gemini จริง */
export function __setGeminiProviderForTest(p: AiProvider | null): void {
  testProvider = p;
}

export function aiStatus(): AiStatus {
  const configured = aiProviderName();
  const mode = appMode();
  const paidTier = geminiPaidTier();
  const model = testProvider?.model ?? geminiModel() ?? null;
  const base = { configured, mode, paidTier };
  if (configured === "rules") return { ...base, active: "rules", model: null, reason: "ตั้งค่าให้ใช้เฉพาะกฎหลักฐาน (AI_PROVIDER=rules)" };
  if (!testProvider && (!geminiApiKey() || !model)) {
    return { ...base, active: "rules", model: null, reason: "ยังไม่ได้ตั้ง GEMINI_API_KEY / GEMINI_MODEL — แสดงเฉพาะผลจากกฎหลักฐาน" };
  }
  if (mode === "hosxp" && !paidTier) {
    return {
      ...base,
      active: "rules",
      model: null,
      reason: "โหมด hosxp ต้องตั้ง GEMINI_PAID_TIER=true (ห้ามใช้ Gemini free tier กับข้อมูลผู้ป่วย) — แสดงเฉพาะผลจากกฎหลักฐาน",
    };
  }
  return { ...base, active: "gemini", model, reason: null };
}

function geminiProvider(): AiProvider {
  if (testProvider) return testProvider;
  const model = geminiModel()!;
  return createGeminiProvider({ model, generate: geminiGenerateFn(geminiApiKey()!, model, aiTimeoutMs()) });
}

export const bookLookup: BookLookup = {
  name: (kind, code) => getCodebook(kind === "dx" ? "ICD10" : "ICD9CM").get(code)?.description ?? null,
  procClass: (code) => procClass(code),
};

/** ข้อความที่จะส่ง AI (ผ่านการตัดข้อมูลและตรวจแล้ว) — throw DeidentificationError ถ้าไม่ผ่าน */
export function promptFor(a: AdmissionDetail, hints: RuleHint[] = ruleHints(a), course?: string | null) {
  const c = deidentify(a, hints);
  const prompt = buildPrompt(c);
  assertNoIdentifiers(prompt, a, course ? [course] : []);
  return { prompt, case: c };
}

function toResult(run: AiRun): AnalyzeResult {
  const r = run.result as Partial<AiAnalysis>;
  return {
    runId: run.id,
    provider: run.provider as AnalyzeResult["provider"],
    model: run.model,
    fallbackReason: run.fallbackReason,
    items: r.items ?? [],
    remarks: r.remarks ?? [],
    draft: r.draft ?? "",
    droppedNoEvidence: r.droppedNoEvidence ?? [],
    secs: r.secs ?? 0,
    createdAt: run.createdAt,
  };
}

/** วิเคราะห์ด้วย AI (ปุ่ม "วิเคราะห์ด้วย AI" / "ให้ AI ร่างรหัส") */
export async function runAnalyze(a: AdmissionDetail, username: string, course?: string | null): Promise<AnalyzeResult> {
  const status = aiStatus();
  const t0 = Date.now();
  let fallbackReason = status.reason;
  let provider: "gemini" | "rules" = "rules";
  let analysis: Omit<AiAnalysis, "secs"> = { items: [], remarks: [], draft: "", droppedNoEvidence: [] };

  let prompt: string | null = null;
  let evidenceOk: ((e: string[]) => boolean) | null = null;
  try {
    const p = promptFor(a, ruleHints(a), course);
    prompt = p.prompt;
    evidenceOk = evidenceMatcher(p.case);
  } catch (e) {
    if (!(e instanceof DeidentificationError)) throw e;
    fallbackReason = `${e.message} — ไม่ส่ง AI`;
  }

  if (prompt && status.active === "gemini") {
    const gemini = geminiProvider();
    let lastError = "";
    for (let attempt = 0; attempt < 2 && provider === "rules"; attempt++) {
      try {
        const out = await gemini.analyze(prompt);
        // กฎหลักฐาน: รหัสใหม่ที่ไม่อ้างหลักฐานเลย → ตัดออก (รหัสที่ AI ยืนยันของเดิมไม่ต้องมีหลักฐาน)
        const have = new Set([...a.diagnoses.map((d) => d.icd10.replace(/\./g, "")), ...a.procedures.map((p) => p.icd9.replace(/\./g, ""))]);
        const dropped = out.items.filter((i) => !i.evidence.length && !have.has(i.code.replace(/\./g, "").toUpperCase()));
        analysis = { ...out, items: out.items.filter((i) => !dropped.includes(i)), droppedNoEvidence: dropped.map((i) => i.code) };
        provider = "gemini";
        fallbackReason = null;
      } catch (e) {
        lastError = e instanceof Error ? `${e.name}: ${e.message}` : "unknown";
      }
    }
    if (provider === "rules") {
      console.warn("[ai] gemini failed twice, fallback to rules:", lastError.slice(0, 200));
      fallbackReason = `AI ไม่ตอบหรือตอบไม่ตรงรูปแบบ 2 ครั้ง — แสดงเฉพาะผลจากกฎหลักฐาน (${lastError.slice(0, 120)})`;
    }
  }
  void evidenceOk;

  const run = await appDb().addAiRun({
    an: a.an,
    kind: "suggest",
    provider,
    model: provider === "gemini" ? (status.model ?? null) : null,
    fallbackReason,
    nSuggestions: analysis.items.length,
    nDroppedNoEvidence: analysis.droppedNoEvidence.length,
    nNotInCodebook: analysis.items.filter((i) => !bookLookup.name(i.kind, i.code)).length,
    result: { ...analysis, secs: Math.round((Date.now() - t0) / 1000) },
    createdBy: username,
  });
  return toResult(run);
}

/** ผล AI ครั้งล่าสุดที่สำเร็จ (Gemini) ของ AN — ใช้รวมกับกฎ */
export async function latestAnalysis(an: string): Promise<AnalyzeResult | null> {
  const run = await appDb().latestAiRun(an, "suggest");
  return run ? toResult(run) : null;
}

// ── ข้อมูลทั้งหน้าของผู้ป่วยหนึ่งราย ─────────────────────────────────────────

export interface Workspace {
  admission: AdmissionDetail;
  alerts: ChartAlert[];
  level: ChartLevel;
  hints: RuleHint[];
  run: AnalyzeResult | null;
  /** ผล AI ที่ใช้รวม (ครั้งล่าสุดที่ได้ผลจาก Gemini) */
  aiRun: AnalyzeResult | null;
  decisions: CodeDecision[];
  items: MergedItem[];
  state: Record<string, "accepted" | "rejected">;
  rw: RwState;
  prompt: string | null;
  promptError: string | null;
  course: CourseText | null;
}

export async function historiesFor(source: PatientSource, pdx: { current: string | null; after: string | null }) {
  const today = todayIso();
  const from = fiscalYearRange(fiscalYearBE(today) - 2).from;
  const to = addDays(today, -1);
  const get = (p: string | null): Promise<GroupingHistory | null> => (p ? source.groupingHistory(p, from, to) : Promise.resolve(null));
  const [current, after] = await Promise.all([get(pdx.current), pdx.after === pdx.current ? null : get(pdx.after)]);
  return { current, after: pdx.after === pdx.current ? current : after };
}

export async function buildWorkspace(a: AdmissionDetail, source: PatientSource): Promise<Workspace> {
  const db = appDb();
  const [decisions, course, run] = await Promise.all([db.listDecisions(a.an), db.getCourse(a.an), latestAnalysis(a.an)]);
  return computeWorkspace(a, source, decisions, course, run);
}

export async function computeWorkspace(
  a: AdmissionDetail,
  source: PatientSource,
  decisions: CodeDecision[],
  course: CourseText | null,
  run: AnalyzeResult | null,
): Promise<Workspace> {
  const hints = ruleHints(a);
  const alerts = chartAlerts(a);
  // ใช้ผลจาก Gemini ครั้งล่าสุดที่สำเร็จ ถ้าครั้งล่าสุด fallback เป็นกฎ
  const aiRun = run && run.provider === "gemini" ? run : run ? await lastGeminiRun(a.an) : null;
  const { state, manual } = decisionView(decisions);
  let prompt: string | null = null;
  let promptError: string | null = null;
  let evidenceOk: ((e: string[]) => boolean) | undefined;
  try {
    const p = promptFor(a, hints, course?.text);
    prompt = p.prompt;
    evidenceOk = evidenceMatcher(p.case);
  } catch (e) {
    if (!(e instanceof DeidentificationError)) throw e;
    promptError = e.reasons.join(" · ");
  }
  const items = merge(a, hints, aiRun?.items ?? null, manual, bookLookup, evidenceOk);
  const accepted = acceptedItems(items, state);
  const histories = await historiesFor(source, rwPdx(a, accepted));
  const rw = rwState(a, accepted, histories, getTdrgTables());
  const stateObj: Record<string, "accepted" | "rejected"> = {};
  for (const [k, v] of state) if (v) stateObj[k] = v as Exclude<DecisionState, undefined>;
  return { admission: a, alerts, level: chartLevel(a, alerts), hints, run, aiRun, decisions, items, state: stateObj, rw, prompt, promptError, course };
}

async function lastGeminiRun(an: string): Promise<AnalyzeResult | null> {
  const runs = await appDb().listAiRunsForAn(an);
  const g = [...runs].reverse().find((r) => r.provider === "gemini" && r.kind === "suggest");
  return g ? toResult(g) : null;
}
