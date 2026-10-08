// lib/ai/schema.ts
// รูปแบบ JSON ที่ AI ต้องตอบ (ชุดเดียวกับโปรแกรมเดิม) — ส่งเป็น responseJsonSchema และ validate ผลด้วย zod

import { z } from "zod";
import type { CodeItem } from "./types";

const conf = z.union([z.number(), z.string()]).optional();
const evidence = z.array(z.union([z.string(), z.number()])).optional();

const Dx = z.object({
  code: z.string().min(1).max(12),
  name: z.string().max(300).optional(),
  reason: z.string().max(1000).optional(),
  rule: z.string().max(40).optional(),
  evidence,
  confidence: conf,
});

export const AnalysisOutput = z.object({
  pdx: Dx.nullable().optional(),
  secondary: z.array(Dx.extend({ diagtype: z.union([z.number(), z.string()]).optional() })).max(40).optional(),
  procedures: z.array(Dx).max(30).optional(),
  remarks: z.array(z.string().max(500)).max(20).optional(),
  course_draft: z.string().max(5000).optional(),
});

export type AnalysisOutputT = z.infer<typeof AnalysisOutput>;

/** JSON schema แบบเรียบสำหรับบังคับรูปแบบคำตอบของ Gemini */
export const analysisJsonSchema = {
  type: "object",
  properties: {
    pdx: {
      type: "object",
      properties: {
        code: { type: "string" },
        name: { type: "string" },
        reason: { type: "string" },
        rule: { type: "string" },
        evidence: { type: "array", items: { type: "string" } },
        confidence: { type: "number" },
      },
      required: ["code"],
    },
    secondary: {
      type: "array",
      items: {
        type: "object",
        properties: {
          code: { type: "string" },
          name: { type: "string" },
          diagtype: { type: "integer" },
          reason: { type: "string" },
          rule: { type: "string" },
          evidence: { type: "array", items: { type: "string" } },
          confidence: { type: "number" },
        },
        required: ["code"],
      },
    },
    procedures: {
      type: "array",
      items: {
        type: "object",
        properties: {
          code: { type: "string" },
          name: { type: "string" },
          reason: { type: "string" },
          evidence: { type: "array", items: { type: "string" } },
          confidence: { type: "number" },
        },
        required: ["code"],
      },
    },
    remarks: { type: "array", items: { type: "string" } },
    course_draft: { type: "string" },
  },
};

/** แปลงคำตอบ AI → รายการรหัส (port จาก fromJson ของโปรแกรมเดิม) */
export function fromJson(js: AnalysisOutputT): CodeItem[] {
  const out: CodeItem[] = [];
  const num = (x: unknown) => {
    const n = typeof x === "number" ? x : parseFloat(String(x));
    return Number.isFinite(n) && n !== 0 ? n : 0.5;
  };
  const rr = (x: { rule?: string; reason?: string }) => (x.rule ? `[${x.rule}] ` : "") + String(x.reason ?? "");
  const arr = (v: unknown) => (Array.isArray(v) ? v.map(String) : []);
  if (js.pdx?.code) {
    out.push({ kind: "dx", code: js.pdx.code, name: js.pdx.name, diagtype: 1, reason: rr(js.pdx), evidence: arr(js.pdx.evidence), confidence: num(js.pdx.confidence), source: "ai" });
  }
  for (const x of js.secondary ?? []) {
    if (!x.code) continue;
    out.push({ kind: "dx", code: x.code, name: x.name, diagtype: parseInt(String(x.diagtype ?? ""), 10) || 2, reason: rr(x), evidence: arr(x.evidence), confidence: num(x.confidence), source: "ai" });
  }
  for (const x of js.procedures ?? []) {
    if (!x.code) continue;
    out.push({ kind: "proc", code: x.code, name: x.name, diagtype: null, reason: String(x.reason ?? ""), evidence: arr(x.evidence), confidence: num(x.confidence), source: "ai" });
  }
  return out;
}
