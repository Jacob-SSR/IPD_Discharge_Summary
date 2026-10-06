// lib/ai/schema.ts
// schema ที่บังคับให้ AI ตอบเป็น JSON — ใช้ทั้งส่งเป็น responseJsonSchema และ validate ผลด้วย zod

import { z } from "zod";

export const SuggestionOutput = z.object({
  code: z.string().min(2).max(10),
  system: z.enum(["ICD10", "ICD9CM"]),
  /** ประเภทการวินิจฉัย 1–5 สำหรับ ICD-10, "-" สำหรับหัตถการ */
  diagtype: z.enum(["1", "2", "3", "4", "5", "-"]),
  description: z.string().max(300),
  rationale: z.string().max(800),
  evidence: z.array(z.string().max(10)).max(15),
});

export const SuggestOutput = z.object({
  suggestions: z.array(SuggestionOutput).max(30),
});

export const CourseOutput = z.object({
  course: z.string().min(1).max(5000),
});

export type SuggestOutputT = z.infer<typeof SuggestOutput>;

export const suggestJsonSchema = z.toJSONSchema(SuggestOutput);
export const courseJsonSchema = z.toJSONSchema(CourseOutput);
