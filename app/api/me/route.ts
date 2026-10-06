// app/api/me/route.ts
import { NextResponse } from "next/server";
import { canDecide, getSession } from "@/lib/auth/session";
import { appMode } from "@/lib/env";

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ user: null }, { status: 401 });
  return NextResponse.json({ user: { ...s, canDecide: canDecide(s) }, mode: appMode() });
}
