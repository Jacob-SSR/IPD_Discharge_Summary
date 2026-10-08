// lib/appdb/mysql.ts
// ฐานข้อมูลแอปบน MySQL/MariaDB (APP_DB_URL) — ไม่ใช่ HOSxP จึงเขียนได้ตามปกติ
// ใช้ฐาน ppchos เดิมของ ppc-hos-10667 ได้ (ตาราง ipdsum_* + บัญชีจาก ppchos.users)

import mysql, { type Pool, type ResultSetHeader, type RowDataPacket } from "mysql2/promise";
import { appUsersTable } from "@/lib/env";
import { APPDB_SCHEMA, T, usersTableSql } from "./schema";
import type {
  AiRun,
  AiRunKind,
  AppDb,
  CodeDecision,
  CourseText,
  UserRecord,
} from "./types";
import type { DiagType, OrType } from "@/lib/patients/types";

type Row = RowDataPacket & Record<string, unknown>;

/** Date → "YYYY-MM-DD HH:MM:SS" ตามเวลาเครื่อง */
function sqlNow(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function iso(v: unknown): string {
  return String(v ?? "").replace(" ", "T");
}

function mapDecision(r: Row): CodeDecision {
  return {
    id: Number(r.id),
    an: String(r.an),
    code: String(r.code),
    system: r.code_system as CodeDecision["system"],
    source: r.source as CodeDecision["source"],
    action: r.action as CodeDecision["action"],
    diagtype: (r.diagtype as DiagType | null) ?? null,
    orType: (r.or_type as OrType | null) ?? null,
    opDate: r.op_date ? String(r.op_date).slice(0, 10) : null,
    provider: (r.provider as string | null) ?? null,
    model: (r.model as string | null) ?? null,
    aiRunId: r.ai_run_id == null ? null : Number(r.ai_run_id),
    decidedBy: String(r.decided_by),
    decidedAt: iso(r.decided_at),
  };
}

function mapRun(r: Row): AiRun {
  return {
    id: Number(r.id),
    an: String(r.an),
    kind: r.kind as AiRunKind,
    provider: String(r.provider),
    model: (r.model as string | null) ?? null,
    fallbackReason: (r.fallback_reason as string | null) ?? null,
    nSuggestions: Number(r.n_suggestions),
    nDroppedNoEvidence: Number(r.n_dropped_no_evidence),
    nNotInCodebook: Number(r.n_not_in_codebook),
    result: JSON.parse(String(r.result_json)),
    createdBy: String(r.created_by),
    createdAt: iso(r.created_at),
  };
}

export function createMysqlAppDb(url: string): AppDb {
  const pool: Pool = mysql.createPool({
    uri: url,
    charset: "UTF8MB4_UNICODE_CI",
    multipleStatements: false,
    connectionLimit: 5,
    dateStrings: true,
  });

  const users = appUsersTable();
  let ready: Promise<void> | null = null;
  function ensure(): Promise<void> {
    if (!ready) {
      ready = (async () => {
        for (const stmt of [usersTableSql(users), ...APPDB_SCHEMA]) {
          try {
            await pool.query(stmt);
          } catch (e) {
            // user ไม่มีสิทธิ์ CREATE (เช่นในฐาน ppchos ที่ใช้ร่วมกัน) → ใช้ได้ถ้า DBA สร้างตารางไว้แล้ว
            const table = /CREATE TABLE IF NOT EXISTS (\S+)/.exec(stmt)?.[1] ?? "?";
            try {
              await pool.query(`SELECT 1 FROM ${table} LIMIT 0`);
            } catch {
              throw new Error(
                `ฐานข้อมูลแอป: ไม่มีตาราง ${table} และสร้างเองไม่ได้ (${(e as Error).message}) — ให้ DBA รัน docs/sql/appdb.sql`,
              );
            }
          }
        }
      })().catch((e) => {
        ready = null;
        throw e;
      });
    }
    return ready;
  }

  async function q<T extends Row>(sql: string, params: unknown[] = []): Promise<T[]> {
    await ensure();
    const [rows] = await pool.query<T[]>(sql, params);
    return rows;
  }

  async function exec(sql: string, params: unknown[]): Promise<ResultSetHeader> {
    await ensure();
    const [res] = await pool.query<ResultSetHeader>(sql, params);
    return res;
  }

  return {
    kind: "mysql",
    async ping() {
      await q("SELECT 1 AS ok");
    },

    async findUser(username) {
      const rows = await q(`SELECT \`user\`, passweb, name, role FROM ${users} WHERE \`user\` = ? LIMIT 1`, [username]);
      if (!rows.length) return null;
      const r = rows[0];
      return {
        user: String(r.user),
        passweb: String(r.passweb),
        name: (r.name as string | null) ?? null,
        role: (r.role as string | null) ?? null,
      } satisfies UserRecord;
    },
    async upsertUser(u) {
      await exec(
        `INSERT INTO ${users} (\`user\`, passweb, name, role) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE passweb = VALUES(passweb), name = VALUES(name), role = VALUES(role)`,
        [u.user, u.passweb, u.name, u.role],
      );
    },

    async updatePassword(username, passweb) {
      await exec(`UPDATE ${users} SET passweb = ? WHERE \`user\` = ?`, [passweb, username]);
    },

    async addDecision(d) {
      const at = sqlNow();
      const res = await exec(
        `INSERT INTO ${T.decisions}
          (an, code, code_system, source, action, diagtype, or_type, op_date, provider, model, ai_run_id, decided_by, decided_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [d.an, d.code, d.system, d.source, d.action, d.diagtype, d.orType, d.opDate, d.provider, d.model, d.aiRunId, d.decidedBy, at],
      );
      return { ...d, id: res.insertId, decidedAt: iso(at) };
    },
    async listDecisions(an) {
      return (await q(`SELECT * FROM ${T.decisions} WHERE an = ? ORDER BY id`, [an])).map(mapDecision);
    },
    async listDecisionsInRange(from, to) {
      return (
        await q(`SELECT * FROM ${T.decisions} WHERE decided_at >= ? AND decided_at < DATE_ADD(?, INTERVAL 1 DAY) ORDER BY id`, [from, to])
      ).map(mapDecision);
    },

    async addAiRun(r) {
      const at = sqlNow();
      const res = await exec(
        `INSERT INTO ${T.aiRuns}
          (an, kind, provider, model, fallback_reason, n_suggestions, n_dropped_no_evidence, n_not_in_codebook, result_json, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [r.an, r.kind, r.provider, r.model, r.fallbackReason, r.nSuggestions, r.nDroppedNoEvidence, r.nNotInCodebook, JSON.stringify(r.result), r.createdBy, at],
      );
      return { ...r, id: res.insertId, createdAt: iso(at) };
    },
    async latestAiRun(an, kind) {
      const rows = await q(`SELECT * FROM ${T.aiRuns} WHERE an = ? AND kind = ? ORDER BY id DESC LIMIT 1`, [an, kind]);
      return rows.length ? mapRun(rows[0]) : null;
    },
    async listAiRunsInRange(from, to) {
      return (
        await q(`SELECT * FROM ${T.aiRuns} WHERE created_at >= ? AND created_at < DATE_ADD(?, INTERVAL 1 DAY) ORDER BY id`, [from, to])
      ).map(mapRun);
    },

    async getCourse(an) {
      const rows = await q(`SELECT * FROM ${T.courses} WHERE an = ? LIMIT 1`, [an]);
      if (!rows.length) return null;
      const r = rows[0];
      return {
        an: String(r.an),
        text: String(r.text),
        source: r.source as CourseText["source"],
        updatedBy: String(r.updated_by),
        updatedAt: iso(r.updated_at),
      };
    },
    async saveCourse(c) {
      const at = sqlNow();
      await exec(
        `INSERT INTO ${T.courses} (an, text, source, updated_by, updated_at) VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE text = VALUES(text), source = VALUES(source), updated_by = VALUES(updated_by), updated_at = VALUES(updated_at)`,
        [c.an, c.text, c.source, c.updatedBy, at],
      );
      return { ...c, updatedAt: iso(at) };
    },

    async audit(e) {
      await exec(`INSERT INTO ${T.audit} (at, username, action, an, detail) VALUES (?, ?, ?, ?, ?)`, [
        sqlNow(),
        e.username,
        e.action,
        e.an,
        e.detail ? e.detail.slice(0, 500) : null,
      ]);
    },
  };
}
