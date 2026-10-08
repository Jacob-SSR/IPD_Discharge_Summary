// lib/appdb/sqlFile.ts — เนื้อหา docs/sql/appdb.sql (สร้างจาก schema.ts; test ตรวจว่าไฟล์ตรงกัน)
import { APPDB_SCHEMA, usersTableSql } from "./schema";

export function appdbSqlFile(): string {
  return [
    "-- docs/sql/appdb.sql — ตารางของแอป IPD Discharge Summary (สร้างจาก lib/appdb/schema.ts ห้ามแก้มือ)",
    "-- รันในฐาน ppchos เดิม (DB_HOST2 ของ ppc-hos-10667) ได้เลย: ตารางของแอปขึ้นต้นด้วย ipdsum_",
    "-- ตาราง users: ถ้าใช้ ppchos.users ที่มีอยู่แล้ว คำสั่งแรกจะไม่ทำอะไร",
    "-- ใช้งาน: mysql -h <DB_HOST2> -u <user> -p ppchos < docs/sql/appdb.sql",
    "",
    ...[usersTableSql("users"), ...APPDB_SCHEMA].map((s) => s.replace(/\n {2}/g, "\n") + ";\n"),
  ].join("\n");
}
