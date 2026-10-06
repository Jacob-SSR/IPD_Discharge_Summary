// lib/appdb/index.ts
// เลือก implementation: มี APP_DB_URL → MySQL, ไม่มี → ไฟล์ JSON (อนุญาตเฉพาะโหมด demo)

import { appDbFile, appDbUrl, isDemo } from "@/lib/env";
import { createFileAppDb } from "./file";
import { createMysqlAppDb } from "./mysql";
import type { AppDb } from "./types";

let instance: AppDb | null = null;

export function appDb(): AppDb {
  if (instance) return instance;
  const url = appDbUrl();
  if (url) {
    instance = createMysqlAppDb(url);
  } else if (isDemo()) {
    instance = createFileAppDb(appDbFile());
  } else {
    throw new Error("โหมด hosxp ต้องตั้ง APP_DB_URL (ฐานข้อมูลของแอป)");
  }
  return instance;
}

export type * from "./types";
