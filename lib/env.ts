// lib/env.ts
// อ่านค่า env แบบมีชนิด — ไม่มีค่า fallback ที่ hardcode (ตาม convention)
// ค่าที่ "ต้องมี" ใช้ process.env.X! แล้วตรวจรูปแบบ ถ้าผิดให้ throw ทันที
// ค่าที่ "ไม่บังคับ" (เช่น REDIS_URL, APP_DB_URL ในโหมด demo) คืน undefined

export type AppMode = "demo" | "hosxp";
export type AiProviderName = "gemini" | "rules";
export type HosxpCharset = "tis620" | "latin1";

function optional(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() !== "" ? v.trim() : undefined;
}

function oneOf<T extends string>(name: string, value: string, allowed: readonly T[]): T {
  if ((allowed as readonly string[]).includes(value)) return value as T;
  throw new Error(`${name} ต้องเป็นหนึ่งใน ${allowed.join(" | ")} (ได้ "${value}")`);
}

function positiveNumber(name: string, value: string): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`${name} ต้องเป็นตัวเลขมากกว่า 0`);
  return n;
}

export function appMode(): AppMode {
  return oneOf("APP_MODE", process.env.APP_MODE!, ["demo", "hosxp"] as const);
}

export function isDemo(): boolean {
  return appMode() === "demo";
}

export function hospitalName(): string {
  return process.env.HOSPITAL_NAME!;
}

export function jwtSecret(): Uint8Array {
  const s = process.env.JWT_SECRET!;
  if (!s || s.length < 32) throw new Error("JWT_SECRET ต้องยาวอย่างน้อย 32 ตัวอักษร");
  return new TextEncoder().encode(s);
}

export function cookieSecure(): boolean {
  return process.env.COOKIE_SECURE === "true";
}

// ── HOSxP (อ่านอย่างเดียว) ───────────────────────────────────────────────────
export function hosxpConfig() {
  return {
    host: process.env.HOSXP_DB_HOST!,
    port: positiveNumber("HOSXP_DB_PORT", process.env.HOSXP_DB_PORT!),
    user: process.env.HOSXP_DB_USER!,
    password: process.env.HOSXP_DB_PASSWORD!,
    database: process.env.HOSXP_DB_NAME!,
    charset: oneOf("HOSXP_DB_CHARSET", process.env.HOSXP_DB_CHARSET!, ["tis620", "latin1"] as const),
  };
}

// ── ฐานข้อมูลของแอปเอง ───────────────────────────────────────────────────────
export function appDbUrl(): string | undefined {
  return optional("APP_DB_URL");
}

/** ที่เก็บไฟล์ฐานข้อมูลแอปในโหมด demo (เมื่อไม่ได้ตั้ง APP_DB_URL) */
export function appDbFile(): string {
  return process.env.APP_DB_FILE!;
}

/**
 * ตารางบัญชีผู้ใช้ในฐานแอป เช่น ppchos.users (บัญชีเดียวกับ ppc-hos-10667) หรือ users
 */
export function appUsersTable(): string {
  const t = (process.env.APP_USERS_TABLE! ?? "").trim();
  if (!/^[A-Za-z0-9_]+(\.[A-Za-z0-9_]+)?$/.test(t)) throw new Error("APP_USERS_TABLE ต้องเป็นชื่อตาราง เช่น ppchos.users");
  return t
    .split(".")
    .map((p) => `\`${p}\``)
    .join(".");
}

function roleList(name: string): string[] {
  const v = process.env[name]!;
  const list = (v ?? "")
    .split(",")
    .map((r) => r.trim().toUpperCase())
    .filter(Boolean);
  if (!list.length) throw new Error(`${name} ต้องระบุ role อย่างน้อย 1 ค่า (คั่นด้วย ,)`);
  return list;
}

/** role ที่เข้าใช้ระบบได้ (ดูข้อมูลผู้ป่วย) — บัญชี role อื่นใน ppchos.users จะ login ไม่ได้ */
export function allowedRoles(): string[] {
  return roleList("APP_ALLOWED_ROLES");
}

/** role ที่ขอคำแนะนำ AI และยืนยัน/เพิ่มรหัสได้ (ต้องเป็นส่วนหนึ่งของ APP_ALLOWED_ROLES) */
export function deciderRoles(): string[] {
  return roleList("APP_DECIDER_ROLES");
}

export function redisUrl(): string | undefined {
  return optional("REDIS_URL");
}

// ── AI ───────────────────────────────────────────────────────────────────────
export function aiProviderName(): AiProviderName {
  return oneOf("AI_PROVIDER", process.env.AI_PROVIDER!, ["gemini", "rules"] as const);
}

export function geminiApiKey(): string | undefined {
  return optional("GEMINI_API_KEY");
}

/** ชื่อรุ่นต้องมาจาก env เท่านั้น — ห้าม hardcode ในโค้ด */
export function geminiModel(): string | undefined {
  return optional("GEMINI_MODEL");
}

export function geminiPaidTier(): boolean {
  return process.env.GEMINI_PAID_TIER === "true";
}

export function aiTimeoutMs(): number {
  return positiveNumber("AI_TIMEOUT_MS", process.env.AI_TIMEOUT_MS!);
}

export function nhsoRatePerAdjRw(): number {
  return positiveNumber("NHSO_RATE_PER_ADJRW", process.env.NHSO_RATE_PER_ADJRW!);
}

// ── โหมด demo: บัญชีเข้าระบบสำหรับทดลอง (ไม่บังคับ) ─────────────────────────
export function demoLogin(): { username: string; password: string } | undefined {
  const username = optional("DEMO_USERNAME");
  const password = optional("DEMO_PASSWORD");
  return username && password ? { username, password } : undefined;
}
