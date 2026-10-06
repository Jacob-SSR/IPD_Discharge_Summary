// lib/drg/tables.ts
// ตาราง TDRG 6.3 — ต้องเติมจากคู่มือที่ผู้ใช้ให้มาเท่านั้น ห้ามเดาค่า RW
//   data/tdrg/tdrg_rw_table.csv   คอลัมน์: drg,description,rw,wtlos,ot,rw0d,of
//   data/tdrg/tdrg_orp_table.csv  คอลัมน์: code,description  (รหัส ICD-9-CM ที่เป็นหัตถการในห้องผ่าตัด)
// ยังไม่มีไฟล์จริง → ไม่มีตาราง (ระบบใช้ค่าเฉลี่ยจากผลจัดกลุ่มย้อนหลังแทน)
// โหมด demo → ใช้ data/tdrg/demo/* ซึ่งเป็นรหัส DEMOxx และค่าสมมติ ไม่ใช่ค่าจริง

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseCsv } from "@/lib/coding/codebook";
import { codeKey, normalizeIcd9 } from "@/lib/coding/icd";
import { isDemo } from "@/lib/env";

export interface DrgParams {
  drg: string;
  description: string;
  rw: number;
  wtlos: number;
  ot: number;
  rw0d: number | null;
  of: number | null;
}

export interface TdrgTables {
  source: string | null;
  isDemo: boolean;
  rw: Map<string, DrgParams>;
  orp: Set<string>;
}

function num(s: string | undefined): number | null {
  if (s == null || s.trim() === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function rowsByHeader(text: string): Record<string, string>[] {
  const rows = parseCsv(text.replace(/^﻿/, ""));
  const header = (rows[0] ?? []).map((h) => h.trim().toLowerCase());
  return rows.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? "").trim()])));
}

export function parseRwTable(text: string): Map<string, DrgParams> {
  const map = new Map<string, DrgParams>();
  for (const r of rowsByHeader(text)) {
    const rw = num(r.rw);
    const wtlos = num(r.wtlos);
    const ot = num(r.ot);
    if (!r.drg || rw == null || wtlos == null || ot == null) continue;
    map.set(r.drg, {
      drg: r.drg,
      description: r.description ?? "",
      rw,
      wtlos,
      ot,
      rw0d: num(r.rw0d),
      of: num(r.of),
    });
  }
  return map;
}

export function parseOrpTable(text: string): Set<string> {
  const set = new Set<string>();
  for (const r of rowsByHeader(text)) {
    if (r.code) set.add(codeKey(normalizeIcd9(r.code)));
  }
  return set;
}

let cached: TdrgTables | null = null;

export function tdrgDir(): string {
  return path.join(process.cwd(), "data", "tdrg");
}

export function getTdrgTables(): TdrgTables {
  if (cached) return cached;
  const dir = tdrgDir();
  const realRw = path.join(dir, "tdrg_rw_table.csv");
  const realOrp = path.join(dir, "tdrg_orp_table.csv");
  const useDemo = !existsSync(realRw) && isDemo();
  const rwFile = useDemo ? path.join(dir, "demo", "tdrg_rw_table.csv") : realRw;
  const orpFile = useDemo ? path.join(dir, "demo", "tdrg_orp_table.csv") : realOrp;
  cached = {
    source: existsSync(rwFile) ? path.relative(dir, rwFile) : null,
    isDemo: useDemo,
    rw: existsSync(rwFile) ? parseRwTable(readFileSync(rwFile, "utf8")) : new Map(),
    orp: existsSync(orpFile) ? parseOrpTable(readFileSync(orpFile, "utf8")) : new Set(),
  };
  return cached;
}

export function isOrProcedure(icd9: string, tables: TdrgTables = getTdrgTables()): boolean | null {
  if (tables.orp.size === 0) return null;
  return tables.orp.has(codeKey(normalizeIcd9(icd9)));
}
