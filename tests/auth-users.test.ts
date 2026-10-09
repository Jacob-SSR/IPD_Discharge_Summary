// login ด้วย ppchos.users แบบอ่านอย่างเดียว (AUTH_DB_*) — ไม่สร้าง/ไม่เขียนตารางผู้ใช้ของ ppc-hos
import { afterEach, describe, expect, it } from "vitest";
import { createMysqlAppDb } from "@/lib/appdb/mysql";
import { userSource } from "@/lib/auth/users";

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
  it("ไม่ตั้ง AUTH_DB_* → ตาราง APP_USERS_TABLE ในฐานของโปรแกรม", () => {
    delete process.env.AUTH_DB_HOST;
    expect(userSource().external).toBe(false);
  });
  it("ใช้ ppchos.users → ฐานของโปรแกรมไม่สร้าง/ไม่เขียนตารางผู้ใช้", async () => {
    const db = createMysqlAppDb("mysql://u:p@127.0.0.1:1/x", { usersTable: false });
    await expect(db.updatePassword("a", "b")).rejects.toThrow(/ppchos\.users/);
    await expect(db.upsertUser({ user: "a", passweb: "b", name: null, role: null })).rejects.toThrow(/ppchos\.users/);
  });
});
