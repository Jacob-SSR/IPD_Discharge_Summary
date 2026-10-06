import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { buildCodebook } from "@/lib/coding/codebook";
import { buildDemoAdmissions } from "@/lib/demo/data";
import type { TdrgTables } from "@/lib/drg/tables";
import { buildAiPayload } from "./deidentify";
import { AiOutputError, createGeminiProvider, type GenerateFn } from "./gemini";
import { __setGeminiProviderForTest, aiStatus, runCourse, runSuggest } from "./index";
import { postprocess } from "./postprocess";
import { ruleCourse, ruleSuggestions } from "./rules";
import type { AiSuggestion } from "./types";

const DEMO = buildDemoAdmissions("2026-10-06");
const byN = (n: number) => DEMO.find((a) => a.an === `6900${String(n).padStart(5, "0")}`)!;

beforeAll(() => {
  process.env.APP_DB_FILE = path.join(mkdtempSync(path.join(tmpdir(), "ipdsum-")), "appdb.json");
});

afterEach(() => {
  __setGeminiProviderForTest(null);
  process.env.AI_PROVIDER = "rules";
  process.env.APP_MODE = "demo";
  process.env.GEMINI_PAID_TIER = "false";
});

describe("rules engine", () => {
  it("เสนอ E87.6 จาก K ต่ำ พร้อมหลักฐาน", () => {
    const s = ruleSuggestions(buildAiPayload(byN(1)));
    expect(s.map((x) => x.code)).toEqual(["E87.6"]);
    expect(s[0].evidence.length).toBeGreaterThan(0);
  });
  it("ไม่เสนอเกล็ดเลือดต่ำในไข้เลือดออก", () => {
    expect(ruleSuggestions(buildAiPayload(byN(6))).map((x) => x.code)).not.toContain("D69.6");
  });
  it("ไม่เสนอซ้ำกับรหัสที่มีอยู่ (E87.5 ในเคส 14)", () => {
    expect(ruleSuggestions(buildAiPayload(byN(14))).map((x) => x.code)).not.toContain("E87.5");
  });
  it("ร่าง course ไม่มีวันที่หรือชื่อ", () => {
    const text = ruleCourse(buildAiPayload(byN(1)));
    expect(text).toContain("Day");
    expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(text).not.toMatch(/[฀-๿]/);
  });
});

describe("gemini provider (จำลอง)", () => {
  const payload = buildAiPayload(byN(1));
  it("แปลง JSON ที่ถูก schema", async () => {
    const gen: GenerateFn = async () =>
      JSON.stringify({ suggestions: [{ code: "E87.6", system: "ICD10", diagtype: "2", description: "Hypokalaemia", rationale: "K low", evidence: ["L2"] }] });
    const p = createGeminiProvider({ model: "test-model", generate: gen });
    expect(await p.suggestCodes(payload)).toEqual([
      { code: "E87.6", system: "ICD10", diagtype: "2", description: "Hypokalaemia", rationale: "K low", evidence: ["L2"] },
    ]);
  });
  it("ผิด schema / ไม่ใช่ JSON → AiOutputError", async () => {
    for (const bad of ["not json", JSON.stringify({ suggestions: [{ code: "X" }] }), undefined]) {
      const p = createGeminiProvider({ model: "m", generate: async () => bad });
      await expect(p.suggestCodes(payload)).rejects.toBeInstanceOf(AiOutputError);
    }
  });
  it("ส่งเฉพาะ payload ที่ตัดข้อมูลแล้ว", async () => {
    let sent = "";
    const p = createGeminiProvider({
      model: "m",
      generate: async (req) => {
        sent = req.user;
        return JSON.stringify({ course: "Day 0 admitted." });
      },
    });
    await p.draftCourse(payload);
    const a = byN(1);
    for (const s of [a.an, a.hn, a.cid!, a.phone!, a.patientName, a.admitDate]) expect(sent).not.toContain(s);
  });
});

describe("postprocess", () => {
  const payload = buildAiPayload(byN(1));
  const books = {
    icd10: buildCodebook("ICD10", "code,description\nE87.6,Hypokalaemia", "t", false),
    icd9: buildCodebook("ICD9CM", "code,description\n99.04,PRC", "t", false),
  };
  const tables: TdrgTables = { source: null, isDemo: false, rw: new Map(), orp: new Set() };
  const s = (o: Partial<AiSuggestion>): AiSuggestion => ({
    code: "E87.6", system: "ICD10", diagtype: "2", description: "", rationale: "", evidence: ["L2"], ...o,
  });

  it("ตัดรหัสที่ไม่มีหลักฐานจริง", () => {
    const r = postprocess([s({ evidence: ["L99"] }), s({ code: "D64.9", evidence: [] })], payload, books, tables);
    expect(r.suggestions).toEqual([]);
    expect(r.dropped.map((d) => d.code)).toEqual(["E87.6", "D64.9"]);
  });
  it("รหัสไม่มีใน codebook ยังแสดง แต่มีคำเตือน", () => {
    const r = postprocess([s({ code: "E87.9" })], payload, books, tables);
    expect(r.suggestions).toHaveLength(1);
    expect(r.suggestions[0].inCodebook).toBe(false);
    expect(r.suggestions[0].warnings.join()).toContain("codebook");
  });
  it("ตัดรหัสซ้ำและรหัสที่มีอยู่แล้ว", () => {
    const r = postprocess([s({}), s({ code: "e876" }), s({ code: "J18.9" })], payload, books, tables);
    expect(r.suggestions.map((x) => x.code)).toEqual(["E87.6"]);
  });
});

describe("เลือก provider + fallback", () => {
  it("ไม่ได้ตั้ง key/model → rules", () => {
    process.env.AI_PROVIDER = "gemini";
    delete process.env.GEMINI_API_KEY;
    expect(aiStatus().active).toBe("rules");
  });
  it("โหมด hosxp ไม่มี paid tier → ห้ามใช้ gemini", () => {
    process.env.AI_PROVIDER = "gemini";
    process.env.APP_MODE = "hosxp";
    __setGeminiProviderForTest(createGeminiProvider({ model: "m", generate: async () => "{}" }));
    const st = aiStatus();
    expect(st.active).toBe("rules");
    expect(st.reason).toContain("GEMINI_PAID_TIER");
  });
  it("gemini ผิด schema → retry 1 ครั้ง แล้ว fallback rules", async () => {
    process.env.AI_PROVIDER = "gemini";
    let calls = 0;
    __setGeminiProviderForTest(createGeminiProvider({ model: "m", generate: async () => { calls++; return "bad"; } }));
    const r = await runSuggest(byN(1), "tester");
    expect(calls).toBe(2);
    expect(r.provider).toBe("rules");
    expect(r.fallbackReason).toContain("Gemini");
    expect(r.suggestions.map((x) => x.code)).toEqual(["E87.6"]);
  });
  it("gemini สำเร็จรอบสอง → ใช้ผล gemini", async () => {
    process.env.AI_PROVIDER = "gemini";
    let calls = 0;
    __setGeminiProviderForTest(
      createGeminiProvider({
        model: "m",
        generate: async () => (++calls === 1 ? "bad" : JSON.stringify({ course: "Day 0 admitted." })),
      }),
    );
    const r = await runCourse(byN(1), "tester");
    expect(r).toMatchObject({ provider: "gemini", model: "m", text: "Day 0 admitted." });
  });
});
