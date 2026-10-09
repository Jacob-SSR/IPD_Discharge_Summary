// lib/appdb/sqlFile.ts — เนื้อหา docs/sql/appdb.sql (สร้างจาก schema.ts; test ตรวจว่าไฟล์ตรงกัน)
import { APPDB_SCHEMA, usersTableSql } from "./schema";

export function appdbSqlFile(): string {
  return [
    "-- docs/sql/appdb.sql — ตารางของแอป IPD Discharge Summary (สร้างจาก lib/appdb/schema.ts ห้ามแก้มือ)",
    "-- ตารางใหม่ของโปรแกรม (ipdsum_*) ไม่มีอยู่เดิมใน HOSxP — วางในฐาน ppchos",
    "-- ตาราง users: ppchos.users มีอยู่แล้ว คำสั่งแรกจะไม่ทำอะไร",
    "-- ใช้งาน (ถ้า user ของโปรแกรมไม่มีสิทธิ์ CREATE): mysql -h <server> -u <admin> -p ppchos < docs/sql/appdb.sql",
    "",
    ...[usersTableSql("users"), ...APPDB_SCHEMA].map((s) => s.replace(/\n {2}/g, "\n") + ";\n"),
  ].join("\n");
}
