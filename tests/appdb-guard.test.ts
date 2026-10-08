// ฐานข้อมูลของโปรแกรมต้องแยกจาก server HOSxP / ppchos — ห้ามสร้างตารางบนเครื่องเหล่านั้น
import { afterEach, describe, expect, it } from "vitest";
import { assertAppDbIsolated } from "@/lib/appdb/guard";
import { createMysqlAppDb } from "@/lib/appdb/mysql";
import { userSource } from "@/lib/auth/users";

const HOSXP = { label: "HOSxP", host: "192.168.1.10", port: 3306 };
const PPCHOS = { label: "ppchos", host: "192.168.1.11", port: 3306 };

describe("APP_DB_URL ต้องไม่อยู่บน server HOSxP / ppchos", () => {
  it("Docker appdb ผ่าน", () => {
    expect(() => assertAppDbIsolated("mysql://ipdsum:x@appdb:3306/ipdsum", [HOSXP, PPCHOS])).not.toThrow();
  });
  it("ชี้ไป server HOSxP หรือ ppchos → ไม่ยอม", () => {
    expect(() => assertAppDbIsolated("mysql://u:p@192.168.1.10:3306/ppchos", [HOSXP, PPCHOS])).toThrow(/HOSxP/);
    expect(() => assertAppDbIsolated("mysql://u:p@192.168.1.11/ppchos", [HOSXP, PPCHOS])).toThrow(/ppchos/);
  });
  it("เครื่องเดียวกันแต่คนละ port (MariaDB ใน Docker) ผ่าน", () => {
    expect(() => assertAppDbIsolated("mysql://u:p@192.168.1.10:3307/ipdsum", [HOSXP])).not.toThrow();
  });
});

describe("บัญชีผู้ใช้", () => {
  const keep = { ...process.env };
  afterEach(() => {
    process.env = { ...keep };
  });
  it("ตั้ง AUTH_DB_* → ppchos.users อ่านอย่างเดียว (ไม่อัปเกรดรหัสผ่านกลับ)", () => {
    Object.assign(process.env, { AUTH_DB_HOST: "192.168.1.11", AUTH_DB_PORT: "3306", AUTH_DB_USER: "u", AUTH_DB_PASS: "p", AUTH_DB_NAME: "ppchos" });
    expect(userSource().external).toBe(true);
    expect(userSource().label).toContain("ppchos.users");
  });
  it("ไม่ตั้ง AUTH_DB_* → ตาราง users ในฐานของโปรแกรม", () => {
    delete process.env.AUTH_DB_HOST;
    expect(userSource().external).toBe(false);
  });
  it("ใช้ ppchos.users → ฐานของโปรแกรมไม่มีตารางผู้ใช้ เขียนบัญชีไม่ได้", async () => {
    const db = createMysqlAppDb("mysql://u:p@127.0.0.1:1/x", { usersTable: false });
    await expect(db.updatePassword("a", "b")).rejects.toThrow(/ppchos\.users/);
    await expect(db.upsertUser({ user: "a", passweb: "b", name: null, role: null })).rejects.toThrow(/ppchos\.users/);
  });
});
