import { describe, expect, it } from "vitest";
import { canDecide, isAllowedRole } from "@/lib/auth/session";
import { appUsersTable } from "@/lib/env";

// env ใน vitest.config.mts: APP_ALLOWED_ROLES=DOCTOR,ADMIN,FINANCE / APP_DECIDER_ROLES=DOCTOR
describe("สิทธิ์ตาม role ของ ppchos.users", () => {
  it("เข้าได้เฉพาะ role ที่อนุญาต", () => {
    expect(isAllowedRole("DOCTOR")).toBe(true);
    expect(isAllowedRole("finance")).toBe(true);
    expect(isAllowedRole("NURSE_OPD")).toBe(false);
    expect(isAllowedRole("USER")).toBe(false);
  });
  it("ยืนยันรหัสได้เฉพาะ APP_DECIDER_ROLES", () => {
    expect(canDecide({ username: "a", name: null, role: "DOCTOR" })).toBe(true);
    expect(canDecide({ username: "a", name: null, role: "FINANCE" })).toBe(false);
    expect(canDecide({ username: "a", name: null, role: "ADMIN" })).toBe(false);
  });
  it("ชื่อตารางผู้ใช้ต้องเป็น identifier เท่านั้น", () => {
    expect(appUsersTable()).toBe("`users`");
    process.env.APP_USERS_TABLE = "ppchos.users";
    expect(appUsersTable()).toBe("`ppchos`.`users`");
    process.env.APP_USERS_TABLE = "users; DROP TABLE x";
    expect(() => appUsersTable()).toThrow();
    process.env.APP_USERS_TABLE = "users";
  });
});
