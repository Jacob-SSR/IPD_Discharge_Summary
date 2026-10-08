// lib/ai/provider.ts
// interface กลางของ AI — หน้าเว็บ/route เรียกผ่าน lib/ai (index.ts) เท่านั้น สลับ provider ได้โดยไม่แก้หน้าเว็บ
// (ollama ไว้ทีหลัง: เพิ่มไฟล์ ollama.ts ที่ implement AiProvider.analyze(prompt) แล้วเพิ่มใน index.ts)

export type { AiAnalysis, AiProvider, AnalyzeResult, CodeItem, DeidentifiedCase, MergedItem, ProviderName } from "./types";
