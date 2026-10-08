import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { appdbSqlFile } from "@/lib/appdb/sqlFile";
import { APPDB_SCHEMA } from "@/lib/appdb/schema";

describe("docs/sql/appdb.sql", () => {
  it("ตรงกับ lib/appdb/schema.ts (ถ้าไม่ตรง ให้รัน node --import tsx scripts/write-appdb-sql.ts)", () => {
    expect(readFileSync(path.join(__dirname, "..", "docs", "sql", "appdb.sql"), "utf8")).toBe(appdbSqlFile());
  });
  it("ตารางของแอปขึ้นต้นด้วย ipdsum_ ทั้งหมด (วางในฐาน ppchos ได้โดยไม่ชน)", () => {
    for (const s of APPDB_SCHEMA) expect(s).toMatch(/CREATE TABLE IF NOT EXISTS ipdsum_/);
  });
});
