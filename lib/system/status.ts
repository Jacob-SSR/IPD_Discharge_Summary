// lib/system/status.ts
// หน้า "ตรวจการเชื่อมต่อ" — ตรวจ HOSxP (และว่า user อ่านอย่างเดียวจริง), ฐานข้อมูลแอป, Redis, AI, codebook, ตาราง TDRG
// แสดงเฉพาะสถานะ/ชื่อ ไม่แสดงข้อมูลผู้ป่วย และไม่แสดงรหัสผ่าน/API key

import { aiStatus } from "@/lib/ai";
import { appDb } from "@/lib/appdb";
import { getCodebook } from "@/lib/coding/codebook";
import { ADJRW_FORMULA_VERIFIED } from "@/lib/drg/adjrw";
import { getTdrgTables } from "@/lib/drg/tables";
import { appMode, hosxpConfig } from "@/lib/env";
import { hosxpPing, hosxpQuery } from "@/lib/hosxp/pool";
import { getRedis } from "@/lib/redis";
import { CLINICAL_REVIEWED } from "@/lib/ai/rules.config";

export type CheckState = "ok" | "warn" | "error" | "skip";

export interface StatusCheck {
  key: string;
  label: string;
  state: CheckState;
  detail: string;
}

const WRITE_PRIVS = /\b(ALL PRIVILEGES|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|INDEX|TRIGGER|EXECUTE|SUPER|FILE)\b/i;

function errText(e: unknown): string {
  return e instanceof Error ? e.message.slice(0, 200) : "unknown error";
}

export async function systemStatus(): Promise<StatusCheck[]> {
  const mode = appMode();
  const checks: StatusCheck[] = [
    {
      key: "mode",
      label: "โหมดการทำงาน",
      state: mode === "demo" ? "warn" : "ok",
      detail: mode === "demo" ? "demo — ใช้ข้อมูลสมมติ ไม่ได้ต่อ HOSxP" : "hosxp — อ่านข้อมูลจาก HOSxP จริง",
    },
  ];

  // HOSxP
  if (mode === "hosxp") {
    try {
      const cfg = hosxpConfig();
      const p = await hosxpPing();
      checks.push({ key: "hosxp", label: "HOSxP", state: "ok", detail: `${p.version} · ฐาน ${p.database} · ${cfg.host} · charset ${cfg.charset}` });
      try {
        const grants = await hosxpQuery<Record<string, string>>("SHOW GRANTS FOR CURRENT_USER()");
        const lines = grants.map((g) => Object.values(g)[0] ?? "");
        const risky = lines.filter((l) => WRITE_PRIVS.test(l.replace(/^GRANT\s+/i, "").split(" ON ")[0]));
        checks.push({
          key: "hosxp-readonly",
          label: "HOSxP: สิทธิ์อ่านอย่างเดียว",
          state: risky.length ? "error" : "ok",
          detail: risky.length
            ? "user นี้มีสิทธิ์เขียน/แก้โครงสร้าง — ต้องเปลี่ยนเป็น user อ่านอย่างเดียว (docs/sql/create_readonly_user.sql)"
            : "user มีเฉพาะสิทธิ์อ่าน",
        });
      } catch (e) {
        checks.push({ key: "hosxp-readonly", label: "HOSxP: สิทธิ์อ่านอย่างเดียว", state: "warn", detail: `ตรวจสิทธิ์ไม่ได้: ${errText(e)}` });
      }
    } catch (e) {
      checks.push({ key: "hosxp", label: "HOSxP", state: "error", detail: `เชื่อมต่อไม่ได้: ${errText(e)}` });
    }
  } else {
    checks.push({ key: "hosxp", label: "HOSxP", state: "skip", detail: "ไม่ใช้ในโหมด demo" });
  }

  // ฐานข้อมูลแอป
  try {
    const db = appDb();
    await db.ping();
    checks.push({
      key: "appdb",
      label: "ฐานข้อมูลแอป",
      state: db.kind === "file" ? "warn" : "ok",
      detail: db.kind === "file" ? "ไฟล์ JSON (เฉพาะโหมด demo)" : "MySQL (APP_DB_URL)",
    });
  } catch (e) {
    checks.push({ key: "appdb", label: "ฐานข้อมูลแอป", state: "error", detail: errText(e) });
  }

  // Redis
  const redis = getRedis();
  if (!redis) {
    checks.push({ key: "redis", label: "Redis (cache)", state: "warn", detail: "ไม่ได้ตั้ง REDIS_URL — ทำงานได้แต่ไม่มี cache" });
  } else {
    try {
      const pong = await redis.ping();
      checks.push({ key: "redis", label: "Redis (cache)", state: "ok", detail: pong });
    } catch (e) {
      checks.push({ key: "redis", label: "Redis (cache)", state: "error", detail: errText(e) });
    }
  }

  // AI
  const ai = aiStatus();
  checks.push({
    key: "ai",
    label: "AI",
    state: ai.reason ? "warn" : "ok",
    detail:
      `ตั้งค่า: ${ai.configured} · ใช้จริง: ${ai.active}${ai.model ? ` (${ai.model})` : ""} · paid tier: ${ai.paidTier ? "ใช่" : "ไม่"}` +
      (ai.reason ? ` · ${ai.reason}` : ""),
  });
  checks.push({
    key: "rules",
    label: "กฎหลักฐาน (port จากโปรแกรมเดิม)",
    state: CLINICAL_REVIEWED ? "ok" : "warn",
    detail: CLINICAL_REVIEWED ? "ผ่านการตรวจทางคลินิกแล้ว" : "เกณฑ์ lab ใน lib/coding/legacyRules.ts อนุมานจากผลของโปรแกรมเดิม — ยังไม่ผ่านการตรวจทางคลินิก",
  });

  // codebook
  for (const sys of ["ICD10", "ICD9CM"] as const) {
    const b = getCodebook(sys);
    checks.push({
      key: `codebook-${sys}`,
      label: `Codebook ${sys === "ICD10" ? "ICD-10-TM" : "ICD-9-CM"}`,
      state: b.size === 0 ? "error" : b.isDemo ? "warn" : "ok",
      detail: b.size === 0 ? "ไม่มีไฟล์ใน data/codebooks/" : `${b.source} · ${b.size.toLocaleString()} รหัส${b.isDemo ? " (ชุด demo)" : " (จาก OCR ยังไม่ได้ตรวจทาน)"}`,
    });
  }

  // TDRG
  const t = getTdrgTables();
  checks.push({
    key: "tdrg",
    label: "ตาราง TDRG 6.3",
    state: t.rw.size === 0 ? "warn" : t.isDemo ? "warn" : "ok",
    detail:
      t.rw.size === 0
        ? "ยังไม่มี data/tdrg/tdrg_rw_table.csv — ค่าประมาณใช้ค่าเฉลี่ยย้อนหลังแทน"
        : `${t.source} · ${t.rw.size} DRG${t.isDemo ? " (ค่าสมมติ)" : ""} · OR/Non-OR จาก codebook ICD-9-CM`,
  });
  checks.push({
    key: "adjrw",
    label: "สูตร AdjRW",
    state: ADJRW_FORMULA_VERIFIED ? "ok" : "warn",
    detail: ADJRW_FORMULA_VERIFIED ? "ตรงกับ rw_estimator.py ของโปรแกรมเดิม (เกิน OT ต้องยืนยันด้วย TDS/TGrp)" : "ยังไม่ได้ยืนยันกับโปรแกรมเดิม/คู่มือ — ใช้เป็นค่าประมาณเท่านั้น",
  });
  return checks;
}
