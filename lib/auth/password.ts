// lib/auth/password.ts
// รองรับรหัสผ่านแบบ md5 เก่า (เหมือน ppchos.users) แล้วอัปเกรดเป็น bcrypt เมื่อ login สำเร็จ

import bcrypt from "bcryptjs";
import { createHash, timingSafeEqual } from "node:crypto";

export function isBcrypt(hash: string): boolean {
  return /^\$2[aby]\$/.test(hash);
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (isBcrypt(stored)) return bcrypt.compare(password, stored);
  const md5 = createHash("md5").update(password).digest("hex");
  const a = Buffer.from(md5.toLowerCase());
  const b = Buffer.from(stored.toLowerCase());
  return a.length === b.length && timingSafeEqual(a, b);
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}
