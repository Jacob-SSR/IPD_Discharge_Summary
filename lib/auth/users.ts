// lib/auth/users.ts
// แหล่งบัญชีผู้ใช้สำหรับ login
//   - ตั้ง AUTH_DB_* → อ่าน ppchos.users ของ ppc-hos-10667 แบบอ่านอย่างเดียว (แนวเดียวกับ rca)
//     SELECT อย่างเดียว ผ่าน SQL guard + session read only · ไม่สร้างตาราง ไม่อัปเกรดรหัสผ่านกลับ
//     (ppc-hos เป็นเจ้าของตารางนี้ — ให้มีระบบเดียวที่เขียน)
//   - ไม่ตั้ง → ตาราง users ในฐานข้อมูลของแอปเอง (Docker) จัดการด้วย npm run create-user

import mysql, { type Pool, type RowDataPacket } from "mysql2/promise";
import { appDb } from "@/lib/appdb";
import type { UserRecord } from "@/lib/appdb/types";
import { authDbConfig } from "@/lib/env";
import { assertReadOnlySql } from "@/lib/sql-guard";

export interface UserSource {
  /** true = ppchos.users (ห้ามเขียนกลับ) */
  readonly external: boolean;
  readonly label: string;
  findUser(username: string): Promise<UserRecord | null>;
  ping(): Promise<void>;
}

let pool: Pool | null = null;

function authPool(): Pool {
  if (pool) return pool;
  const cfg = authDbConfig()!;
  pool = mysql.createPool({
    ...cfg,
    // ppchos เก็บภาษาไทยเป็น TIS-620 แบบเดียวกับ HOSxP (ppc-hos / rca)
    charset: "TIS620_THAI_CI",
    multipleStatements: false,
    connectionLimit: 3,
    connectTimeout: 10_000,
  });
  pool.pool.on("connection", (conn) => {
    conn.query("SET SESSION TRANSACTION READ ONLY", (err: Error | null) => {
      if (err) console.warn("[auth-db] ตั้ง session read only ไม่ได้:", err.message);
    });
  });
  return pool;
}

async function select(sql: string, params: unknown[]): Promise<RowDataPacket[]> {
  assertReadOnlySql(sql);
  const [rows] = await authPool().query<RowDataPacket[]>(sql, params);
  return rows;
}

const ppchosUsers: UserSource = {
  external: true,
  get label() {
    const c = authDbConfig()!;
    return `${c.database}.users ที่ ${c.host} (อ่านอย่างเดียว)`;
  },
  async findUser(username) {
    let rows: RowDataPacket[];
    try {
      rows = await select("SELECT `user`, passweb, name, role FROM `users` WHERE `user` = ? LIMIT 1", [username]);
    } catch (e) {
      if ((e as { code?: string }).code === "ER_NO_SUCH_TABLE") {
        throw new Error(`ไม่พบตาราง users ในฐาน "${authDbConfig()!.database}" — ตาราง users อยู่ในฐาน ppchos (AUTH_DB_NAME=ppchos)`);
      }
      throw e;
    }
    if (!rows.length) return null;
    const r = rows[0];
    return { user: String(r.user), passweb: String(r.passweb), name: (r.name as string | null) ?? null, role: (r.role as string | null) ?? null };
  },
  async ping() {
    await select("SELECT 1 AS ok", []);
  },
};

const appUsers: UserSource = {
  external: false,
  label: "ตาราง users ในฐานข้อมูลของแอป",
  findUser: (username) => appDb().findUser(username),
  ping: () => appDb().ping(),
};

export function userSource(): UserSource {
  return authDbConfig() ? ppchosUsers : appUsers;
}
