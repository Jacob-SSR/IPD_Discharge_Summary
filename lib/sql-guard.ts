// lib/sql-guard.ts
// ด่านกันเขียนลง HOSxP — ทุก query ที่ส่งเข้า pool HOSxP ต้องผ่าน assertReadOnlySql()
// (ไฟล์นี้อยู่นอก lib/hosxp/** โดยตั้งใจ เพื่อให้ใน lib/hosxp ไม่มีคำสั่งเขียนแม้แต่ในรูป regex)
//
// ชั้นป้องกันทั้งหมด:
//   1) user ฐานข้อมูลเป็นแบบอ่านอย่างเดียว (docs/sql/create_readonly_user.sql)
//   2) ทุก connection ตั้ง SESSION TRANSACTION READ ONLY
//   3) ฟังก์ชันนี้ปฏิเสธ SQL ที่ไม่ใช่การอ่าน
//   4) unit test สแกน lib/hosxp/** ว่าไม่มีคำสั่งเขียน

const WRITE_KEYWORDS =
  /\b(INSERT|UPDATE|DELETE|REPLACE\s+INTO|MERGE|UPSERT|CREATE|ALTER|DROP|TRUNCATE|RENAME|GRANT|REVOKE|LOCK|UNLOCK|CALL|LOAD|HANDLER|DO|SET|COMMIT|ROLLBACK|START|BEGIN)\b/i;
// หมายเหตุ: REPLACE() ที่เป็นฟังก์ชันสตริงใช้ได้ — ห้ามเฉพาะคำสั่ง REPLACE INTO

const ALLOWED_START = /^(SELECT|SHOW|WITH|DESCRIBE|DESC|EXPLAIN)\b/i;

export class ReadOnlyViolation extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReadOnlyViolation";
  }
}

/** ตัด comment และข้อความในเครื่องหมายคำพูดออกก่อนตรวจคำสั่ง */
function stripLiterals(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n]*/g, " ")
    .replace(/#[^\n]*/g, " ")
    .replace(/'(?:\\.|''|[^'\\])*'/g, "''")
    .replace(/"(?:\\.|""|[^"\\])*"/g, '""')
    .replace(/`[^`]*`/g, "``");
}

export function assertReadOnlySql(sql: string): void {
  const body = stripLiterals(sql).trim();
  if (!ALLOWED_START.test(body)) {
    throw new ReadOnlyViolation("HOSxP: อนุญาตเฉพาะคำสั่งอ่าน (SELECT/SHOW/WITH)");
  }
  // ห้ามหลาย statement
  const withoutTrailing = body.replace(/;\s*$/, "");
  if (withoutTrailing.includes(";")) {
    throw new ReadOnlyViolation("HOSxP: ห้ามส่งหลายคำสั่งในครั้งเดียว");
  }
  if (WRITE_KEYWORDS.test(withoutTrailing)) {
    throw new ReadOnlyViolation("HOSxP: พบคำสั่งที่ไม่ใช่การอ่าน");
  }
  if (/\bINTO\s+(OUT|DUMP)FILE\b/i.test(withoutTrailing) || /\bFOR\s+UPDATE\b/i.test(withoutTrailing)) {
    throw new ReadOnlyViolation("HOSxP: ห้าม INTO OUTFILE / FOR UPDATE");
  }
}
