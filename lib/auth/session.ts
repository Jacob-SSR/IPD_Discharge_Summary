// lib/auth/session.ts
// JWT ใน httpOnly cookie อายุ 8 ชม. — แบบเดียวกับ ppc-hos-10667 (ใช้ jose แทน jsonwebtoken)

import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { allowedRoles, deciderRoles, jwtSecret } from "@/lib/env";

// ชื่อไม่ซ้ำ ppc-hos ("token") — cookie แยกตาม host ไม่แยกตาม port ถ้ารันบนเครื่องเดียวกันจะทับกัน
export const SESSION_COOKIE = "ipdsum_token";
export const SESSION_MAX_AGE = 60 * 60 * 8;

export interface Session {
  username: string;
  name: string | null;
  role: string;
}

/** role ที่เข้าใช้ระบบได้ (APP_ALLOWED_ROLES) — ใช้ทั้งตอน login และใน proxy ทุก request */
export function isAllowedRole(role: string): boolean {
  const allowed = allowedRoles();
  // "*" = ทุกบัญชีใน ppchos.users เข้าได้ (เหมือน ppc-hos)
  return allowed.includes("*") || allowed.includes(role.toUpperCase());
}

/** role ที่ขอคำแนะนำ AI และยืนยัน/ไม่ยืนยัน/เพิ่มรหัสได้ (APP_DECIDER_ROLES) */
export function canDecide(s: Session): boolean {
  return isAllowedRole(s.role) && deciderRoles().includes(s.role.toUpperCase());
}

export async function signSession(s: Session): Promise<string> {
  return new SignJWT({ username: s.username, name: s.name, role: s.role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(jwtSecret());
}

export async function verifySession(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, jwtSecret());
    if (typeof payload.username !== "string") return null;
    return {
      username: payload.username,
      name: typeof payload.name === "string" ? payload.name : null,
      role: typeof payload.role === "string" ? payload.role.toUpperCase() : "USER",
    };
  } catch {
    return null;
  }
}

/** อ่าน session ใน route handler / server component */
export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value);
}
