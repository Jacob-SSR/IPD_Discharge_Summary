// lib/appdb/index.ts
// เลือก implementation: มี APP_DB_URL → MySQL (ฐาน ppchos — ตารางใหม่ ipdsum_* ของโปรแกรม), ไม่มี → ไฟล์ JSON (เฉพาะโหมด demo)
// โปรแกรมสร้าง/เขียนเฉพาะตาราง ipdsum_* ไม่แตะตารางเดิมของ HOSxP

import { appDbFile, appDbUrl, authDbConfig, isDemo } from "@/lib/env";
import { createFileAppDb } from "./file";
import { createMysqlAppDb } from "./mysql";
import type { AppDb } from "./types";

let instance: AppDb | null = null;

export function appDb(): AppDb {
  if (instance) return instance;
  const url = appDbUrl();
  if (url) {
    // login ด้วย ppchos.users แบบอ่านอย่างเดียว (AUTH_DB_*) → ไม่สร้าง/ไม่เขียนตารางผู้ใช้
    instance = createMysqlAppDb(url, { usersTable: !authDbConfig() });
  } else if (isDemo()) {
    instance = createFileAppDb(appDbFile());
  } else {
    throw new Error("โหมด hosxp ต้องตั้ง APP_DB_URL (ฐานข้อมูลของแอป)");
  }
  return instance;
}

export type * from "./types";
