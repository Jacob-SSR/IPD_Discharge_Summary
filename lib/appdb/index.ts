// lib/appdb/index.ts
// เลือก implementation: มี APP_DB_URL → MySQL (service appdb ใน Docker), ไม่มี → ไฟล์ JSON (อนุญาตเฉพาะโหมด demo)
// ฐานนี้เป็นที่เดียวที่โปรแกรมสร้างตาราง — ห้ามอยู่บน server HOSxP / ppchos (guard.ts)

import { appDbFile, appDbUrl, appMode, authDbConfig, hosxpConfig, isDemo } from "@/lib/env";
import { createFileAppDb } from "./file";
import { assertAppDbIsolated, type ServerRef } from "./guard";
import { createMysqlAppDb } from "./mysql";
import type { AppDb } from "./types";

let instance: AppDb | null = null;

export function appDb(): AppDb {
  if (instance) return instance;
  const url = appDbUrl();
  if (url) {
    const protectedServers: ServerRef[] = [];
    if (appMode() === "hosxp") {
      const h = hosxpConfig();
      protectedServers.push({ label: "HOSxP (HOSXP_DB_HOST)", host: h.host, port: h.port });
    }
    const a = authDbConfig();
    if (a) protectedServers.push({ label: "ppchos (AUTH_DB_HOST)", host: a.host, port: a.port });
    assertAppDbIsolated(url, protectedServers);
    instance = createMysqlAppDb(url, { usersTable: !a });
  } else if (isDemo()) {
    instance = createFileAppDb(appDbFile());
  } else {
    throw new Error("โหมด hosxp ต้องตั้ง APP_DB_URL (ฐานข้อมูลของแอป)");
  }
  return instance;
}

export type * from "./types";
