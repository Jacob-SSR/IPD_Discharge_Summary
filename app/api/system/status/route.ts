// app/api/system/status/route.ts — หน้า "ตรวจการเชื่อมต่อ"
import { NextResponse } from "next/server";
import { errorResponse, requireSession } from "@/lib/api";
import { systemStatus } from "@/lib/system/status";

export async function GET() {
  try {
    await requireSession();
    return NextResponse.json({ checks: await systemStatus() });
  } catch (e) {
    return errorResponse(e, "system-status");
  }
}
