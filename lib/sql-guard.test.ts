import { describe, expect, it } from "vitest";
import { assertReadOnlySql, ReadOnlyViolation } from "./sql-guard";

describe("assertReadOnlySql", () => {
  it("อนุญาต SELECT/SHOW/WITH", () => {
    expect(() => assertReadOnlySql("SELECT * FROM ipt WHERE an = ?")).not.toThrow();
    expect(() => assertReadOnlySql("  select 1;")).not.toThrow();
    expect(() => assertReadOnlySql("SHOW GRANTS FOR CURRENT_USER()")).not.toThrow();
    expect(() => assertReadOnlySql("WITH x AS (SELECT 1) SELECT * FROM x")).not.toThrow();
    // คำว่า update อยู่ในข้อความ/ชื่อคอลัมน์ ไม่ใช่คำสั่ง
    expect(() => assertReadOnlySql("SELECT 'update' AS a, last_update FROM t")).not.toThrow();
    // ฟังก์ชัน REPLACE() ใช้ได้
    expect(() => assertReadOnlySql("SELECT * FROM iptdiag WHERE REPLACE(icd10, '.', '') = ?")).not.toThrow();
  });
  it.each([
    "UPDATE ipt SET dchdate = NULL",
    "DELETE FROM iptdiag",
    "INSERT INTO iptdiag VALUES (1)",
    "DROP TABLE ipt",
    "SELECT 1; DELETE FROM ipt",
    "SELECT * FROM ipt FOR UPDATE",
    "SELECT * INTO OUTFILE '/tmp/x' FROM ipt",
    "/* x */ TRUNCATE ipt",
    "CALL sp_x()",
    "WITH x AS (SELECT 1) DELETE FROM ipt",
    "SELECT 1; REPLACE INTO ipt VALUES (1)",
  ])("ปฏิเสธ: %s", (sql) => {
    expect(() => assertReadOnlySql(sql)).toThrow(ReadOnlyViolation);
  });
});
