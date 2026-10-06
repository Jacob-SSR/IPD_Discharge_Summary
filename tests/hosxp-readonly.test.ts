// กฎข้อ 1: ห้ามมี INSERT/UPDATE/DELETE/DDL ใน lib/hosxp/**
// (test นี้อยู่นอก lib/hosxp โดยตั้งใจ เพราะตัวมันเองมีคำเหล่านี้)
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.join(__dirname, "..", "lib", "hosxp");
const FORBIDDEN = /\b(INSERT|UPDATE|DELETE|REPLACE\s+INTO|CREATE|ALTER|DROP|TRUNCATE|RENAME|GRANT|REVOKE)\b/i;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

describe("lib/hosxp อ่านอย่างเดียว", () => {
  it("ไม่มีคำสั่งเขียนหรือ DDL ในไฟล์ใดเลย", () => {
    const files = walk(ROOT);
    expect(files.length).toBeGreaterThan(0);
    const offenders = files.flatMap((f) =>
      readFileSync(f, "utf8")
        .split("\n")
        .map((line, i) => ({ f: path.relative(ROOT, f), i: i + 1, line }))
        .filter((x) => FORBIDDEN.test(x.line)),
    );
    expect(offenders).toEqual([]);
  });
});
