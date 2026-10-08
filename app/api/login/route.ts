// app/api/login/route.ts
// เข้าสู่ระบบด้วยบัญชีในตาราง APP_USERS_TABLE (เช่น ppchos.users = บัญชีเดียวกับ ppc-hos-10667)
// เข้าได้เฉพาะ role ใน APP_ALLOWED_ROLES เพราะหน้านี้มีข้อมูลผู้ป่วย
// โหมด demo: ใช้ DEMO_USERNAME / DEMO_PASSWORD จาก env ได้ด้วย (role DOCTOR)

import { NextResponse } from "next/server";
import { z } from "zod";
import { appDb } from "@/lib/appdb";
import { hashPassword, isBcrypt, verifyPassword } from "@/lib/auth/password";
import { clientIp, rateLimit } from "@/lib/auth/rateLimit";
import { isAllowedRole, SESSION_COOKIE, SESSION_MAX_AGE, signSession, type Session } from "@/lib/auth/session";
import { errorResponse } from "@/lib/api";
import { cookieSecure, demoLogin, isDemo } from "@/lib/env";

const MINUTE = 60_000;
const Body = z.object({
  username: z.string().trim().min(1).max(50),
  password: z.string().min(1).max(200),
});

function tooMany(retryAfterSec: number, message: string) {
  return NextResponse.json(
    { error: message },
    { status: 429, headers: { "Retry-After": String(retryAfterSec) } },
  );
}

export async function POST(req: Request) {
  try {
    const ip = clientIp(req);
    const ipLimit = await rateLimit(`login:ip:${ip}`, 10, 5 * MINUTE);
    if (!ipLimit.ok) return tooMany(ipLimit.retryAfterSec, "พยายามเข้าสู่ระบบบ่อยเกินไป กรุณารอสักครู่");

    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "กรุณากรอกชื่อผู้ใช้และรหัสผ่าน" }, { status: 400 });
    }
    const { username, password } = parsed.data;

    const userLimit = await rateLimit(`login:user:${username.toLowerCase()}`, 5, 15 * MINUTE);
    if (!userLimit.ok) return tooMany(userLimit.retryAfterSec, "บัญชีนี้ถูกพยายามเข้าสู่ระบบหลายครั้งเกินไป กรุณารอสักครู่");

    let session: Session | null = null;
    let upgradeHash = false;

    const demo = isDemo() ? demoLogin() : undefined;
    if (demo && username === demo.username && password === demo.password) {
      session = { username, name: "ผู้ใช้ทดลอง (demo)", role: "DOCTOR" };
    } else {
      const db = appDb();
      const user = await db.findUser(username);
      if (user && (await verifyPassword(password, user.passweb))) {
        upgradeHash = !isBcrypt(user.passweb);
        session = { username: user.user, name: user.name, role: (user.role ?? "USER").toUpperCase() };
      }
    }

    if (!session) {
      return NextResponse.json({ error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" }, { status: 401 });
    }
    if (!isAllowedRole(session.role)) {
      await appDb().audit({ username: session.username, action: "login-denied-role", an: null, detail: session.role });
      return NextResponse.json(
        { error: `บัญชีนี้ (role ${session.role}) ไม่มีสิทธิ์ใช้ระบบสรุปเวชระเบียน — ติดต่อผู้ดูแลระบบ` },
        { status: 403 },
      );
    }

    if (upgradeHash) {
      // อัปเกรด md5 → bcrypt แบบเดียวกับ ppc-hos (ตารางผู้ใช้ในฐานแอป ไม่ใช่ HOSxP) — เฉพาะบัญชีที่มีสิทธิ์ใช้ระบบนี้
      await appDb().updatePassword(session.username, await hashPassword(password));
    }
    await appDb().audit({ username: session.username, action: "login", an: null, detail: null });

    const res = NextResponse.json({ ok: true, role: session.role });
    res.cookies.set(SESSION_COOKIE, await signSession(session), {
      httpOnly: true,
      secure: cookieSecure(),
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });
    return res;
  } catch (e) {
    return errorResponse(e, "login");
  }
}
