// lib/auth/session.ts
// JWT ใน httpOnly cookie ชื่อ "token" อายุ 8 ชม. — แบบเดียวกับ ppc-hos-10667 (ใช้ jose แทน jsonwebtoken)

import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { jwtSecret } from "@/lib/env";

export const SESSION_COOKIE = "token";
export const SESSION_MAX_AGE = 60 * 60 * 8;

export interface Session {
  username: string;
  name: string | null;
  role: string;
}

/** role ที่กดยืนยัน/ไม่ยืนยันรหัส และเพิ่มรหัสเองได้ */
export const DECISION_ROLES = ["DOCTOR", "ADMIN"] as const;

export function canDecide(s: Session): boolean {
  return (DECISION_ROLES as readonly string[]).includes(s.role);
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
