// lib/ai/provider.ts
// interface กลางของ AI — หน้าเว็บ/route เรียกผ่านตัวนี้เท่านั้น สลับ provider ได้โดยไม่แก้หน้าเว็บ
// (ollama ไว้ทีหลัง: เพิ่มไฟล์ ollama.ts ที่ implement AiProvider แล้วเพิ่มใน index.ts)

export type {
  AiProvider,
  AiSuggestion,
  CheckedSuggestion,
  CourseResult,
  DeidentifiedCase,
  ProviderName,
  SuggestResult,
} from "./types";
