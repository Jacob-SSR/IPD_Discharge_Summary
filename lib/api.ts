// lib/api.ts
// ตัวช่วยสำหรับ route handler: ตรวจ session, ตอบ error แบบเดียวกันทุก route
// ⚠️ ห้าม log ข้อมูลผู้ป่วย — log เฉพาะชนิดของ error

import { NextResponse } from "next/server";
import { canDecide, getSession, type Session } from "@/lib/auth/session";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function requireSession(): Promise<Session> {
  const s = await getSession();
  if (!s) throw new HttpError(401, "กรุณาเข้าสู่ระบบ");
  return s;
}

export async function requireDecider(): Promise<Session> {
  const s = await requireSession();
  if (!canDecide(s)) throw new HttpError(403, "เฉพาะแพทย์ (role DOCTOR) ที่ยืนยันรหัสได้");
  return s;
}

export function errorResponse(e: unknown, context: string): NextResponse {
  if (e instanceof HttpError) {
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
  // log แค่ชื่อ error และ context — ไม่ log payload/ข้อมูลผู้ป่วย
  console.error(`[${context}]`, e instanceof Error ? `${e.name}: ${e.message}` : "unknown error");
  return NextResponse.json({ error: "เกิดข้อผิดพลาดภายในระบบ" }, { status: 500 });
}
