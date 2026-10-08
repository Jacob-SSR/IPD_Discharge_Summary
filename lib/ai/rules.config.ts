// lib/ai/rules.config.ts
// เกณฑ์ของกฎหลักฐาน (lib/coding/legacyRules.ts) port จากผลของโปรแกรมเดิม — ทุก 22 รายให้ผลตรงกัน (tests/legacy-rules.test.ts)
// ⚠️ เกณฑ์ตัวเลข (K < 3.5, Na < 135, Hct < 30, Plt < 100, Cr > 1.5, FBS ≥ 200) อนุมานจากผลลัพธ์ของโปรแกรมเดิม
//    เป็นการตัดสินใจทางคลินิก ต้องให้แพทย์/ผู้ให้รหัสตรวจทานก่อนใช้จริง

export const CLINICAL_REVIEWED = false;
