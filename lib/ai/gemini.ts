// lib/ai/gemini.ts
// Gemini ผ่าน @google/genai — เรียกจากฝั่ง server เท่านั้น (ใช้ใน route handler; API key อ่านจาก env ฝั่ง server
// ไม่มี NEXT_PUBLIC_ จึงไม่ถูกส่งไป browser)
// - บังคับผลเป็น JSON ตาม schema (responseMimeType + responseJsonSchema) แล้ว validate ด้วย zod
// - รับเฉพาะ DeidentifiedCase (ผ่าน buildAiPayload แล้ว) — ไม่มีทางส่ง AdmissionDetail ตรงได้
// - ชื่อรุ่นมาจาก env GEMINI_MODEL เท่านั้น
// - ห้าม log prompt/payload

import { GoogleGenAI } from "@google/genai";
import type { ZodType } from "zod";
import { CourseOutput, courseJsonSchema, SuggestOutput, suggestJsonSchema } from "./schema";
import type { AiProvider, AiSuggestion, DeidentifiedCase } from "./types";

export class AiOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiOutputError";
  }
}

/** ฟังก์ชันเรียกโมเดล — แยกไว้เพื่อให้ test ใส่ตัวจำลองได้ */
export type GenerateFn = (req: {
  system: string;
  user: string;
  jsonSchema: unknown;
}) => Promise<string | undefined>;

const SUGGEST_SYSTEM = `You are a clinical coding assistant for inpatient discharge summaries at a Thai community hospital.
Input: a de-identified JSON case containing ONLY structured data (existing ICD-10 codes, procedures, numeric lab results, drugs, length of stay, age, sex). Day numbers count from admission (day 0 = admission day).
Task: propose ADDITIONAL codes that are missing from the record:
- ICD-10-TM (2009, based on WHO ICD-10) diagnosis codes, with diagtype 1=principal, 2=comorbidity, 3=complication, 4=other, 5=external cause.
- ICD-9-CM procedure codes (system ICD9CM, diagtype "-").
Rules:
1. Every suggestion MUST cite at least one evidence id from the input (e.g. "L3", "M2", "P1", "D1"). Never cite ids that do not exist.
2. Only suggest codes directly supported by the cited data. Do not infer diagnoses from normal values. Do not invent findings.
3. Do not repeat codes already present in existingDiagnoses or procedures.
4. Follow ICD-10 morbidity coding rules (MB1-MB5), dagger/asterisk convention, sequelae rules, and pair injuries with external cause codes.
5. Use the most specific valid code with a dot (e.g. "E87.6", "99.04").
6. Suggestions are drafts that a physician will review one by one. If nothing is supported, return an empty list.
Write description and rationale in English, concise.`;

const COURSE_SYSTEM = `You write a draft "Course in hospital" paragraph for an inpatient discharge summary.
Input: a de-identified JSON case with ONLY structured data. Day numbers count from admission (day 0).
Write 3-8 concise sentences in English, chronological, using "Day N" instead of dates.
Mention only facts present in the data (diagnoses, key abnormal labs, main treatments, procedures, length of stay).
Do not invent symptoms, exam findings, names, dates, or outcomes that are not in the data. This is a draft for physician editing.`;

function parseJson<T>(text: string | undefined, schema: ZodType<T>): T {
  if (!text) throw new AiOutputError("AI ไม่ส่งผลลัพธ์");
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new AiOutputError("AI ตอบไม่เป็น JSON");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new AiOutputError("AI ตอบไม่ตรง schema");
  return parsed.data;
}

export function createGeminiProvider(opts: {
  model: string;
  generate: GenerateFn;
}): AiProvider {
  return {
    name: "gemini",
    model: opts.model,

    async suggestCodes(input: DeidentifiedCase): Promise<AiSuggestion[]> {
      const text = await opts.generate({
        system: SUGGEST_SYSTEM,
        user: JSON.stringify(input),
        jsonSchema: suggestJsonSchema,
      });
      const out = parseJson(text, SuggestOutput);
      return out.suggestions.map((s) => ({
        code: s.code,
        system: s.system,
        diagtype: s.system === "ICD10" && s.diagtype !== "-" ? s.diagtype : s.system === "ICD10" ? "4" : null,
        description: s.description,
        rationale: s.rationale,
        evidence: s.evidence,
      }));
    },

    async draftCourse(input: DeidentifiedCase): Promise<string> {
      const text = await opts.generate({
        system: COURSE_SYSTEM,
        user: JSON.stringify(input),
        jsonSchema: courseJsonSchema,
      });
      return parseJson(text, CourseOutput).course.trim();
    },
  };
}

/** ตัวเรียก Gemini จริง */
export function geminiGenerateFn(apiKey: string, model: string, timeoutMs: number): GenerateFn {
  const client = new GoogleGenAI({ apiKey });
  return async ({ system, user, jsonSchema }) => {
    const res = await client.models.generateContent({
      model,
      contents: user,
      config: {
        systemInstruction: system,
        temperature: 0.1,
        responseMimeType: "application/json",
        responseJsonSchema: jsonSchema,
        abortSignal: AbortSignal.timeout(timeoutMs),
        httpOptions: { timeout: timeoutMs },
      },
    });
    return res.text;
  };
}
