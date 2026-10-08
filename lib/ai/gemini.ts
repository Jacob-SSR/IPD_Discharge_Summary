// lib/ai/gemini.ts
// Gemini ผ่าน @google/genai — เรียกจากฝั่ง server เท่านั้น (API key อ่านจาก env ฝั่ง server ไม่มี NEXT_PUBLIC_)
// - รับเฉพาะข้อความที่สร้างจาก DeidentifiedCase (buildPrompt) และผ่าน assertNoIdentifiers แล้ว
// - บังคับผลเป็น JSON (responseMimeType + responseJsonSchema) แล้ว validate ด้วย zod
// - ชื่อรุ่นมาจาก env GEMINI_MODEL เท่านั้น · ห้าม log prompt

import { GoogleGenAI } from "@google/genai";
import { AnalysisOutput, analysisJsonSchema, fromJson } from "./schema";
import type { AiProvider } from "./types";

export class AiOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiOutputError";
  }
}

/** ฟังก์ชันเรียกโมเดล — แยกไว้เพื่อให้ test ใส่ตัวจำลองได้ */
export type GenerateFn = (req: { prompt: string; jsonSchema: unknown; signal?: AbortSignal }) => Promise<string | undefined>;

export function parseAnalysis(text: string | undefined) {
  if (!text) throw new AiOutputError("AI ไม่ส่งผลลัพธ์");
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new AiOutputError("AI ตอบกลับไม่เป็น JSON");
  }
  const parsed = AnalysisOutput.safeParse(raw);
  if (!parsed.success) throw new AiOutputError("AI ตอบไม่ตรง schema");
  const items = fromJson(parsed.data);
  if (!items.length) throw new AiOutputError("AI ไม่เสนอรหัสใดเลย");
  return {
    items,
    remarks: (parsed.data.remarks ?? []).map(String),
    draft: String(parsed.data.course_draft ?? "").trim(),
  };
}

export function createGeminiProvider(opts: { model: string; generate: GenerateFn }): AiProvider {
  return {
    name: "gemini",
    model: opts.model,
    async analyze(prompt) {
      return parseAnalysis(await opts.generate({ prompt, jsonSchema: analysisJsonSchema }));
    },
  };
}

/** ตัวเรียก Gemini จริง */
export function geminiGenerateFn(apiKey: string, model: string, timeoutMs: number): GenerateFn {
  const client = new GoogleGenAI({ apiKey });
  return async ({ prompt, jsonSchema }) => {
    const res = await client.models.generateContent({
      model,
      contents: prompt,
      config: {
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
