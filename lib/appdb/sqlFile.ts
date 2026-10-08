// lib/appdb/sqlFile.ts — เนื้อหา docs/sql/appdb.sql (สร้างจาก schema.ts; test ตรวจว่าไฟล์ตรงกัน)
import { APPDB_SCHEMA, usersTableSql } from "./schema";

export function appdbSqlFile(): string {
  return [
    "-- docs/sql/appdb.sql — ตารางของแอป IPD Discharge Summary (สร้างจาก lib/appdb/schema.ts ห้ามแก้มือ)",
    "-- รันอัตโนมัติใน Docker (service appdb ของ docker-compose.yml) ตอนสร้างฐานครั้งแรก — ไม่ต้องรันบน server HOSxP / ppchos",
    "-- ตาราง users: ใช้เฉพาะเมื่อไม่ได้ตั้ง AUTH_DB_* (login ด้วย ppchos.users แบบอ่านอย่างเดียว)",
    "",
    ...[usersTableSql("users"), ...APPDB_SCHEMA].map((s) => s.replace(/\n {2}/g, "\n") + ";\n"),
  ].join("\n");
}
