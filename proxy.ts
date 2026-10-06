// proxy.ts (Next 16: แทน middleware.ts)
// DENY BY DEFAULT — ทุกหน้าและทุก API ต้อง login ยกเว้นหน้า login เอง
// route ใหม่ถูกล็อกอัตโนมัติ ไม่ต้องมาแก้ไฟล์นี้

import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";

const PUBLIC_PATHS = ["/login", "/api/login", "/api/logout"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  if (session) return NextResponse.next();

  const res = pathname.startsWith("/api")
    ? NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 })
    : NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(pathname)}`, request.url));
  if (request.cookies.has(SESSION_COOKIE)) {
    res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, expires: new Date(0), path: "/" });
  }
  return res;
}

export const config = {
  // ทุกเส้นทาง ยกเว้นไฟล์ static ของ Next และไฟล์ใน public
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|jpg|ico|css|js|woff2?)$).*)"],
};
