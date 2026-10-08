// lib/appdb/guard.ts
// ฐานข้อมูลของแอปเป็นที่เดียวที่โปรแกรมสร้างตาราง/เขียนข้อมูล — ต้องอยู่ใน Docker (service appdb)
// ห้ามชี้ APP_DB_URL ไปที่ server HOSxP หรือ server ppchos (ppc-hos) เพื่อไม่ให้มีการสร้างตารางบนเครื่องเหล่านั้น

export interface ServerRef {
  label: string;
  host: string;
  port: number;
}

export function serverOfUrl(url: string): ServerRef {
  const u = new URL(url);
  return { label: "APP_DB_URL", host: u.hostname.toLowerCase(), port: Number(u.port || 3306) };
}

/** throw ถ้าฐานข้อมูลของแอปอยู่บน server เดียวกับที่ห้ามเขียน (host + port ตรงกัน) */
export function assertAppDbIsolated(appDbUrl: string, protectedServers: ServerRef[]): void {
  const app = serverOfUrl(appDbUrl);
  for (const s of protectedServers) {
    if (s.host.toLowerCase() === app.host && s.port === app.port) {
      throw new Error(
        `APP_DB_URL ชี้ไปที่ server เดียวกับ ${s.label} (${s.host}:${s.port}) — ห้ามสร้างตารางของโปรแกรมบน server นั้น ` +
          `ใช้ฐานข้อมูลของแอปใน Docker (service appdb ใน docker-compose.yml: mysql://...@appdb:3306/ipdsum)`,
      );
    }
  }
}
