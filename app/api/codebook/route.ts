// app/api/codebook/route.ts — ค้นหา/ตรวจรหัสใน codebook (ใช้ตอนแพทย์เพิ่มรหัสเอง)
import { NextResponse } from "next/server";
import { errorResponse, requireSession } from "@/lib/api";
import { getCodebook } from "@/lib/coding/codebook";
import { isValidFormat, normalizeCode } from "@/lib/coding/icd";

export async function GET(req: Request) {
  try {
    await requireSession();
    const sp = new URL(req.url).searchParams;
    const system = sp.get("system") === "ICD9CM" ? "ICD9CM" : "ICD10";
    const q = (sp.get("q") ?? "").slice(0, 50);
    const book = getCodebook(system);
    const code = normalizeCode(system, q);
    return NextResponse.json({
      system,
      code,
      validFormat: isValidFormat(system, code),
      inCodebook: book.size ? book.has(code) : null,
      entry: book.get(code),
      matches: book.search(q, 15),
      codebook: { source: book.source, isDemo: book.isDemo, size: book.size },
    });
  } catch (e) {
    return errorResponse(e, "codebook");
  }
}
