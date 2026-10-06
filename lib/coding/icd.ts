// lib/coding/icd.ts
// จัดรูปแบบรหัส ICD-10 / ICD-9-CM ให้เป็นมาตรฐานเดียวกันก่อนเทียบ codebook/กฎ

import type { CodeSystem } from "@/lib/appdb/types";

/** "j189" / "J18.9†" / "G63.2*" → "J18.9" / "G63.2" */
export function normalizeIcd10(raw: string): string {
  const s = raw.toUpperCase().replace(/[\s†*+!]/g, "").replace(/\./g, "");
  if (!/^[A-Z][0-9]{2}[0-9A-Z]{0,2}$/.test(s)) return raw.toUpperCase().trim();
  return s.length > 3 ? `${s.slice(0, 3)}.${s.slice(3)}` : s;
}

/** "4709" / "47.09" → "47.09" */
export function normalizeIcd9(raw: string): string {
  const s = raw.replace(/[\s.]/g, "");
  if (!/^[0-9]{2,4}$/.test(s)) return raw.trim();
  return s.length > 2 ? `${s.slice(0, 2)}.${s.slice(2)}` : s;
}

export function normalizeCode(system: CodeSystem, raw: string): string {
  return system === "ICD10" ? normalizeIcd10(raw) : normalizeIcd9(raw);
}

export function isValidIcd10Format(code: string): boolean {
  return /^[A-Z][0-9]{2}(\.[0-9A-Z]{1,2})?$/.test(code);
}

export function isValidIcd9Format(code: string): boolean {
  return /^[0-9]{2}(\.[0-9]{1,2})?$/.test(code);
}

export function isValidFormat(system: CodeSystem, code: string): boolean {
  return system === "ICD10" ? isValidIcd10Format(code) : isValidIcd9Format(code);
}

/** หมวด 3 ตัวแรก เช่น "J18.9" → "J18" */
export function category(code: string): string {
  return code.slice(0, 3);
}

/** ช่วงรหัส เช่น inRange("S72.0", "S00", "T98") */
export function inRange(code: string, from: string, to: string): boolean {
  const c = category(code);
  return c >= from && c <= to;
}

/** แปลงเป็น key สำหรับเทียบ (ตัดจุด) */
export function codeKey(code: string): string {
  return code.replace(/\./g, "").toUpperCase();
}
