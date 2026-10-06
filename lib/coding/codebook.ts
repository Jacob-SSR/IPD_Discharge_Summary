// lib/coding/codebook.ts
// โหลด codebook จาก data/codebooks/*.csv
//   ICD-10-TM : icd10tm_2009_AL.csv  (จาก OCR ยังไม่ได้ตรวจ — มีแค่เล่ม A–L)
//   ICD-9-CM  : icd9cm_fy15.csv
// รูปแบบไฟล์: บรรทัดแรกเป็นหัวตาราง มีคอลัมน์ code และ description (หรือใช้ 2 คอลัมน์แรก)
// ถ้ายังไม่มีไฟล์จริงและอยู่ในโหมด demo → ใช้ data/codebooks/demo/*.csv (ชุดย่อยสำหรับทดลอง)
// รหัสที่ไม่พบใน codebook ต้องแสดงคำเตือนเสมอ ห้ามซ่อน

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { CodeSystem } from "@/lib/appdb/types";
import { isDemo } from "@/lib/env";
import { codeKey, normalizeCode } from "./icd";

export interface CodebookEntry {
  code: string;
  description: string;
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
    const rows = parseCsv(csvText.replace(/^﻿/, ""));
    const header = rows[0]?.map((h) => h.trim().toLowerCase()) ?? [];
    const ci = header.indexOf("code") >= 0 ? header.indexOf("code") : 0;
    const di = header.indexOf("description") >= 0 ? header.indexOf("description") : 1;
    const hasHeader = header.includes("code");
    for (const r of rows.slice(hasHeader ? 1 : 0)) {
      const raw = (r[ci] ?? "").trim();
      if (!raw) continue;
      const code = normalizeCode(system, raw);
      map.set(codeKey(code), { code, description: (r[di] ?? "").trim() });
    }
  }
  const entries = [...map.values()];
  return {
    system,
    source,
    isDemo: demo,
    size: map.size,
    has: (code) => map.has(codeKey(normalizeCode(system, code))),
    get: (code) => map.get(codeKey(normalizeCode(system, code))) ?? null,
    search(q, limit = 20) {
      const needle = q.trim().toLowerCase();
      if (!needle) return [];
      const key = codeKey(needle);
      const byCode = entries.filter((e) => codeKey(e.code).toLowerCase().startsWith(key.toLowerCase()));
      const byText = entries.filter(
        (e) => !byCode.includes(e) && e.description.toLowerCase().includes(needle),
      );
      return [...byCode, ...byText].slice(0, limit);
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
