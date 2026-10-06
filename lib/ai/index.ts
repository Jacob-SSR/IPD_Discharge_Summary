// lib/ai/index.ts
// เลือก provider จาก env AI_PROVIDER = gemini | rules และควบคุมเงื่อนไขความปลอดภัย:
//   - ข้อมูลทุกครั้งผ่าน buildAiPayload() (deidentify + ตรวจซ้ำ) ก่อนถึง provider
//   - โหมด hosxp ต้องมี GEMINI_PAID_TIER=true ถึงจะส่ง Gemini ได้ (ห้ามใช้ free tier กับข้อมูลผู้ป่วย)
//   - Gemini ตอบผิด schema/ล้ม → retry ได้ 1 ครั้ง แล้ว fallback เป็น rules
//   - บันทึก ai_runs เฉพาะผลลัพธ์ (ไม่มีข้อมูลระบุตัวตน) — ไม่เก็บ payload

import { appDb } from "@/lib/appdb";
import { getCodebook } from "@/lib/coding/codebook";
import { getTdrgTables } from "@/lib/drg/tables";
import {
  aiProviderName,
  aiTimeoutMs,
  appMode,
  geminiApiKey,
  geminiModel,
  geminiPaidTier,
} from "@/lib/env";
import type { AdmissionDetail } from "@/lib/patients/types";
import { buildAiPayload, DeidentificationError } from "./deidentify";
import { createGeminiProvider, geminiGenerateFn } from "./gemini";
import { postprocess } from "./postprocess";
import { rulesProvider } from "./rules";
import type { AiProvider, CourseResult, DeidentifiedCase, SuggestResult } from "./types";

export interface AiStatus {
  configured: "gemini" | "rules";
  active: "gemini" | "rules";
  model: string | null;
  paidTier: boolean;
  mode: "demo" | "hosxp";
  /** เหตุผลที่ใช้ rules แทน gemini (ถ้ามี) */
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
  const model = geminiModel() ?? null;
  const base = { configured, mode, paidTier };
  if (configured === "rules") return { ...base, active: "rules", model: null, reason: null };
  if (!testProvider && (!geminiApiKey() || !model)) {
    return { ...base, active: "rules", model: null, reason: "ยังไม่ได้ตั้ง GEMINI_API_KEY / GEMINI_MODEL — ใช้กฎแทน" };
  }
  if (mode === "hosxp" && !paidTier) {
    return {
      ...base,
      active: "rules",
      model: null,
      reason: "โหมด hosxp ต้องตั้ง GEMINI_PAID_TIER=true (ห้ามใช้ Gemini free tier กับข้อมูลผู้ป่วย) — ใช้กฎแทน",
    };
  }
  return { ...base, active: "gemini", model: testProvider?.model ?? model, reason: null };
}

function geminiProvider(): AiProvider {
  if (testProvider) return testProvider;
  const model = geminiModel()!;
  return createGeminiProvider({ model, generate: geminiGenerateFn(geminiApiKey()!, model, aiTimeoutMs()) });
}

/** เรียก Gemini (retry ไม่เกิน 1 ครั้ง) ถ้าไม่สำเร็จ → rules */
async function withFallback<T>(
  payload: DeidentifiedCase,
  call: (p: AiProvider, input: DeidentifiedCase) => Promise<T>,
): Promise<{ value: T; provider: AiProvider; fallbackReason: string | null }> {
  const status = aiStatus();
  if (status.active === "rules") {
    return { value: await call(rulesProvider, payload), provider: rulesProvider, fallbackReason: status.reason };
  }
  const gemini = geminiProvider();
  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return { value: await call(gemini, payload), provider: gemini, fallbackReason: null };
    } catch (e) {
      lastError = e instanceof Error ? `${e.name}: ${e.message}` : "unknown";
    }
  }
  console.warn("[ai] gemini failed twice, fallback to rules:", lastError.slice(0, 200));
  return {
    value: await call(rulesProvider, payload),
    provider: rulesProvider,
    fallbackReason: `Gemini ไม่ตอบหรือตอบไม่ตรง schema 2 ครั้ง — ใช้กฎแทน (${lastError.slice(0, 120)})`,
  };
}

function safePayload(a: AdmissionDetail): { payload: DeidentifiedCase | null; reason: string | null } {
  try {
    return { payload: buildAiPayload(a), reason: null };
  } catch (e) {
    if (e instanceof DeidentificationError) return { payload: null, reason: e.message };
    throw e;
  }
}

export async function runSuggest(a: AdmissionDetail, username: string): Promise<SuggestResult> {
  const { payload, reason } = safePayload(a);
  if (!payload) {
    // ตัดข้อมูลระบุตัวตนไม่ผ่าน → ไม่ส่ง AI และไม่เสนออะไร (ปลอดภัยไว้ก่อน)
    const run = await appDb().addAiRun({
      an: a.an, kind: "suggest", provider: "rules", model: null, fallbackReason: reason,
      nSuggestions: 0, nDroppedNoEvidence: 0, nNotInCodebook: 0, result: { suggestions: [], droppedNoEvidence: [] }, createdBy: username,
    });
    return { runId: run.id, provider: "rules", model: null, fallbackReason: reason, suggestions: [], droppedNoEvidence: [], createdAt: run.createdAt };
  }

  const { value, provider, fallbackReason } = await withFallback(payload, (p, x) => p.suggestCodes(x));
  const books = { icd10: getCodebook("ICD10"), icd9: getCodebook("ICD9CM") };
  const { suggestions, dropped } = postprocess(value, payload, books, getTdrgTables());

  const run = await appDb().addAiRun({
    an: a.an,
    kind: "suggest",
    provider: provider.name,
    model: provider.model,
    fallbackReason,
    nSuggestions: suggestions.length,
    nDroppedNoEvidence: dropped.length,
    nNotInCodebook: suggestions.filter((s) => s.inCodebook === false).length,
    result: { suggestions, droppedNoEvidence: dropped },
    createdBy: username,
  });
  return {
    runId: run.id,
    provider: provider.name,
    model: provider.model,
    fallbackReason,
    suggestions,
    droppedNoEvidence: dropped,
    createdAt: run.createdAt,
  };
}

export async function runCourse(a: AdmissionDetail, username: string): Promise<CourseResult> {
  const { payload, reason } = safePayload(a);
  if (!payload) throw new DeidentificationError([reason ?? "deidentify failed"]);
  const { value, provider, fallbackReason } = await withFallback(payload, (p, x) => p.draftCourse(x));
  const run = await appDb().addAiRun({
    an: a.an,
    kind: "course",
    provider: provider.name,
    model: provider.model,
    fallbackReason,
    nSuggestions: 0,
    nDroppedNoEvidence: 0,
    nNotInCodebook: 0,
    result: { text: value },
    createdBy: username,
  });
  return { runId: run.id, provider: provider.name, model: provider.model, fallbackReason, text: value, createdAt: run.createdAt };
}

/** ผลครั้งล่าสุดที่บันทึกไว้ (เปิดหน้าใหม่ไม่ต้องเรียก AI ซ้ำ) */
export async function latestSuggest(an: string): Promise<SuggestResult | null> {
  const run = await appDb().latestAiRun(an, "suggest");
  if (!run) return null;
  const r = run.result as Pick<SuggestResult, "suggestions" | "droppedNoEvidence">;
  return {
    runId: run.id,
    provider: run.provider as SuggestResult["provider"],
    model: run.model,
    fallbackReason: run.fallbackReason,
    suggestions: r.suggestions ?? [],
    droppedNoEvidence: r.droppedNoEvidence ?? [],
    createdAt: run.createdAt,
  };
}
