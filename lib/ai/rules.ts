// lib/ai/rules.ts
// engine แบบกฎ (fallback เมื่อ AI ไม่ตอบหรือไม่ได้ตั้งค่า) = กฎหลักฐานของโปรแกรมเดิม (lib/coding/legacyRules.ts)
// ผลทุกข้อเป็นข้อเสนอแนะที่แพทย์ต้องกดยืนยันทีละรหัส

export { ruleHints as rulesEngine, type RuleHint } from "@/lib/coding/legacyRules";
export { CLINICAL_REVIEWED } from "./rules.config";
