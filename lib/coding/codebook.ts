// lib/coding/codebook.ts
// โหลด codebook จาก data/codebooks/*.csv (ชุดเดียวกับโปรแกรมเดิม / สนามลอง AI ให้รหัส)
//   ICD-10   : icd10tm_2009_AL.csv  code,description,thai — ICD-10 WHO 2016 + ชื่อไทย ICD-10-TM 2009 (A–L, จาก OCR ยังไม่ได้ตรวจ)
//   ICD-9-CM : icd9cm_fy15.csv      code,description,or,affects_drg — FY15 ฉบับ สรท. (OR / Non-OR / มีผลต่อ DRG)
// รหัสที่ไม่พบใน codebook ต้องแสดงคำเตือนเสมอ ห้ามซ่อน

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { CodeSystem } from "@/lib/appdb/types";
import { isDemo } from "@/lib/env";
import { codeKey, normalizeCode } from "./icd";

export interface CodebookEntry {
  code: string;
  description: string;
  /** ชื่อไทย (ICD-10-TM เล่ม 1ก มีเฉพาะหมวด A–L, อ่านด้วย OCR) */
  thai?: string;
  /** ICD-9-CM: OR procedure / Non-OR procedure (ฉบับ สรท.) */
  orType?: "OR" | "NonOR";
  /** Non-OR แต่มีผลต่อ ThaiDRG */
  affectsDrg?: boolean;
}

export interface Codebook {
  system: CodeSystem;
  /** ไฟล์ที่โหลด (null = ไม่มี codebook) */
  source: string | null;
  isDemo: boolean;
  size: number;
  has(code: string): boolean;
  get(code: string): CodebookEntry | null;
  search(q: string, limit?: number): CodebookEntry[];
}

const FILES: Record<CodeSystem, string> = {
  ICD10: "icd10tm_2009_AL.csv",
  ICD9CM: "icd9cm_fy15.csv",
};

/** CSV แบบง่ายที่รองรับเครื่องหมายคำพูด */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  row.push(field);
  if (row.some((f) => f.trim() !== "")) rows.push(row);
  return rows;
}

export function buildCodebook(
  system: CodeSystem,
  csvText: string | null,
  source: string | null,
  demo: boolean,
): Codebook {
  const map = new Map<string, CodebookEntry>();
  if (csvText) {
    const rows = parseCsv(csvText.replace(/^\uFEFF/, ""));
    const header = rows[0]?.map((h) => h.trim().toLowerCase()) ?? [];
    const col = (name: string, fallback: number) => (header.indexOf(name) >= 0 ? header.indexOf(name) : fallback);
    const ci = col("code", 0);
    const di = col("description", 1);
    const ti = header.indexOf("thai");
    const oi = header.indexOf("or");
    const ai = header.indexOf("affects_drg");
    const hasHeader = header.includes("code");
    for (const r of rows.slice(hasHeader ? 1 : 0)) {
      const raw = (r[ci] ?? "").trim();
      if (!raw) continue;
      const code = normalizeCode(system, raw);
      const e: CodebookEntry = { code, description: (r[di] ?? "").trim() };
      const thai = ti >= 0 ? (r[ti] ?? "").trim() : "";
      if (thai) e.thai = thai;
      const or = oi >= 0 ? (r[oi] ?? "").trim().toUpperCase() : "";
      if (or) e.orType = or === "OR" ? "OR" : "NonOR";
      if (ai >= 0 && (r[ai] ?? "").trim() === "1") e.affectsDrg = true;
      map.set(codeKey(code), e);
    }
  }
  const entries = [...map.values()];
  const lower = entries.map((e) => e.description.toLowerCase());
  return {
    system,
    source,
    isDemo: demo,
    size: map.size,
    has: (code) => map.has(codeKey(normalizeCode(system, code))),
    get: (code) => map.get(codeKey(normalizeCode(system, code))) ?? null,
    /**
     * ค้นแบบโปรแกรมเดิม: ขึ้นต้นด้วยรหัส > ชื่อไทยมีคำที่พิมพ์ > ชื่ออังกฤษมีทุกคำ
     * ภายในกลุ่มเดียวกัน รหัสสั้น (หมวดกว้าง) มาก่อน แล้วเรียงตามรหัส
     */
    search(q, limit = 15) {
      const query = q.trim();
      if (query.length < 2) return [];
      const key = codeKey(query).replace(/[^A-Z0-9]/g, "");
      const words = query.toLowerCase().split(/\s+/).filter(Boolean);
      const hits: [number, number, string, CodebookEntry][] = [];
      for (let i = 0; i < entries.length; i++) {
        const e = entries[i];
        const k = codeKey(e.code);
        const byCode = key !== "" && k.startsWith(key);
        const byTh = !!e.thai && e.thai.includes(query);
        const byName = words.length > 0 && words.every((w) => lower[i].includes(w));
        if (byCode || byTh || byName) hits.push([byCode ? 0 : byTh ? 1 : 2, k.length, k, e]);
        if (hits.length > 400) break;
      }
      hits.sort((a, b) => a[0] - b[0] || a[1] - b[1] || (a[2] < b[2] ? -1 : 1));
      return hits.slice(0, limit).map((h) => h[3]);
    },
  };
}

const cache = new Map<CodeSystem, Codebook>();

export function codebookDir(): string {
  return path.join(process.cwd(), "data", "codebooks");
}

export function getCodebook(system: CodeSystem): Codebook {
  const hit = cache.get(system);
  if (hit) return hit;
  const real = path.join(codebookDir(), FILES[system]);
  const demo = path.join(codebookDir(), "demo", FILES[system]);
  let book: Codebook;
  if (existsSync(real)) {
    book = buildCodebook(system, readFileSync(real, "utf8"), FILES[system], false);
  } else if (isDemo() && existsSync(demo)) {
    book = buildCodebook(system, readFileSync(demo, "utf8"), `demo/${FILES[system]}`, true);
  } else {
    book = buildCodebook(system, null, null, false);
  }
  cache.set(system, book);
  return book;
}

/**
 * OR / Non-OR ของหัตถการ: จาก codebook ICD-9-CM ฉบับ สรท. ก่อน
 * ไม่มีในตาราง → แบบโปรแกรมเดิม: บท 87 ขึ้นไป (ตรวจวินิจฉัย/รักษาอื่น) = Non-OR นอกนั้น = OR
 */
export function procClass(code: string, book: Codebook = getCodebook("ICD9CM")): "OR" | "NonOR" {
  const e = book.get(code);
  if (e?.orType) return e.orType;
  const ch = parseInt(code.replace(/\D/g, "").slice(0, 2), 10);
  return ch >= 87 ? "NonOR" : "OR";
}
