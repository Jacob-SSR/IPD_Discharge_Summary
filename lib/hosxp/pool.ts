// lib/hosxp/pool.ts
// pool สำหรับ HOSxP — อ่านอย่างเดียว
//   - ใช้ user ที่มีแค่สิทธิ์ SELECT (docs/sql/create_readonly_user.sql) แนะนำให้ต่อ Slave/Replica
//   - ทุก connection ตั้ง session เป็น read only
//   - ทุก query ผ่าน assertReadOnlySql() ก่อนส่ง
//   - multipleStatements: false เสมอ

import mysql, { type Pool, type RowDataPacket } from "mysql2/promise";
import { hosxpConfig } from "@/lib/env";
import { assertReadOnlySql } from "@/lib/sql-guard";
import { fixRowThai } from "./thai";

let pool: Pool | null = null;
let charset: "tis620" | "latin1" = "tis620";

function getPool(): Pool {
  if (pool) return pool;
  const cfg = hosxpConfig();
  charset = cfg.charset;
  pool = mysql.createPool({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    database: cfg.database,
    charset: cfg.charset === "tis620" ? "TIS620_THAI_CI" : "LATIN1_SWEDISH_CI",
    multipleStatements: false,
    connectionLimit: 5,
    dateStrings: true,
    connectTimeout: 10_000,
  });
  // ตั้ง session ให้อ่านอย่างเดียวทุก connection ใหม่ (ชั้นป้องกันเพิ่มจากสิทธิ์ user)
  pool.pool.on("connection", (conn) => {
    conn.query("SET SESSION TRANSACTION READ ONLY");
  });
  return pool;
}

/** ส่ง SELECT ไป HOSxP แล้วคืนแถว (แปลงภาษาไทยให้ถ้าใช้ latin1) */
export async function hosxpQuery<T extends Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  assertReadOnlySql(sql);
  const [rows] = await getPool().query<RowDataPacket[]>(sql, params);
  const list = rows as unknown as T[];
  return charset === "latin1" ? list.map(fixRowThai) : list;
}

/** สำหรับหน้า "ตรวจการเชื่อมต่อ" และสคริปต์ check-schema */
export async function hosxpPing(): Promise<{ version: string; database: string }> {
  const rows = await hosxpQuery<{ version: string; db: string }>(
    "SELECT VERSION() AS version, DATABASE() AS db",
  );
  return { version: String(rows[0]?.version ?? ""), database: String(rows[0]?.db ?? "") };
}

export async function closeHosxpPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
