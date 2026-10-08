import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import type { CodeDecision } from "@/lib/appdb/types";
import { ruleHints } from "@/lib/coding/legacyRules";
import { buildDemoAdmissions } from "@/lib/demo/data";
import { demoSource } from "@/lib/demo/source";
import { AiOutputError, createGeminiProvider, parseAnalysis, type GenerateFn } from "./gemini";
import { __setGeminiProviderForTest, aiStatus, buildWorkspace, promptFor, runAnalyze } from "./index";
import { acceptedItems, decisionView, merge, type BookLookup } from "./merge";

const DEMO = buildDemoAdmissions("2026-10-08");
const byAn = (an: string) => DEMO.find((a) => a.an === an)!;
const book: BookLookup = { name: (_k, c) => (c === "E87.6" ? "Hypokalaemia" : null), procClass: () => "NonOR" };

const AI_JSON = JSON.stringify({
  pdx: { code: "J44.1", name: "COPD with exacerbation", reason: "หอบ", rule: "MB1", evidence: ["Salbutamol NB"], confidence: 0.8 },
  secondary: [{ code: "E876", diagtype: 3, reason: "K ต่ำ", evidence: ["Potassium 3.0"], confidence: 0.7 }],
  procedures: [{ code: "93.94", reason: "พ่นยา", evidence: ["Salbutamol NB"], confidence: 0.6 }],
  remarks: ["ข้อสังเกต"],
  course_draft: "ร่างสรุป",
});

beforeAll(() => {
  process.env.APP_DB_FILE = path.join(mkdtempSync(path.join(tmpdir(), "ipdsum-")), "appdb.json");
});

afterEach(() => {
  __setGeminiProviderForTest(null);
  process.env.AI_PROVIDER = "rules";
  process.env.APP_MODE = "demo";
  process.env.GEMINI_PAID_TIER = "false";
});

describe("parseAnalysis (รูปแบบ JSON ของโปรแกรมเดิม)", () => {
  it("แปลง pdx/secondary/procedures + remarks + course_draft", () => {
    const r = parseAnalysis(AI_JSON);
    expect(r.items.map((i) => [i.kind, i.code, i.diagtype, i.reason])).toEqual([
      ["dx", "J44.1", 1, "[MB1] หอบ"],
      ["dx", "E876", 3, "K ต่ำ"],
      ["proc", "93.94", null, "พ่นยา"],
    ]);
    expect(r.remarks).toEqual(["ข้อสังเกต"]);
    expect(r.draft).toBe("ร่างสรุป");
  });
  it("ไม่ใช่ JSON / ผิด schema / ไม่มีรหัส → AiOutputError", () => {
    for (const bad of ["not json", JSON.stringify({ pdx: { code: 5 } }), JSON.stringify({ remarks: [] }), undefined]) {
      expect(() => parseAnalysis(bad)).toThrow(AiOutputError);
    }
  });
});

describe("merge (merge_and_validate ของโปรแกรมเดิม)", () => {
  const a = byAn("690001402"); // รอสรุป: ER ลง J44.1
  const hints = ruleHints(a);
  it("ยังไม่ใช้ AI: แสดงเฉพาะกฎ", () => {
    const m = merge(a, hints, null, [], book);
    expect(m.every((x) => x.source === "rule")).toBe(true);
    expect(m.map((x) => x.code)).toContain("J44.1");
  });
  it("AI + กฎตรงกัน → ai+rule และความมั่นใจ +0.1, ตัดรหัส ER ที่ AI ไม่เลือก", () => {
    const m = merge(a, hints, parseAnalysis(AI_JSON).items, [], book);
    const j = m.find((x) => x.code === "J44.1")!;
    expect(j.source).toBe("ai+rule");
    expect(j.diagtype).toBe(1);
    expect(m.find((x) => x.code === "E87.6")).toMatchObject({ source: "ai+rule", name: "Hypokalaemia", inBook: true });
    expect(m.find((x) => x.code === "93.94")?.source).toBe("ai+rule");
    expect(m.filter((x) => x.source === "rule" && x.origin === "admit")).toEqual([]);
  });
  it("รหัสไม่มีใน codebook ยังแสดง (inBook=false) ไม่ซ่อน", () => {
    const m = merge(a, [], [{ kind: "dx", code: "Q99.9", diagtype: 2, reason: "", evidence: [], confidence: 0.5, source: "ai" }], [], book);
    expect(m[0]).toMatchObject({ code: "Q99.9", inBook: false, formatOk: true });
  });
  it("รหัสที่ลงไว้แล้ว → already, เสนอเปลี่ยนเป็น PDx", () => {
    const b = byAn("690001245");
    const m = merge(b, [], [{ kind: "dx", code: "I10", diagtype: 1, reason: "x", evidence: [], confidence: 0.5, source: "ai" }], [], book);
    expect(m[0].already).toBe(false);
    expect(m[0].reason).toBe("[แนะนำเปลี่ยนเป็น PDx] x");
  });
});

describe("decisionView: ยอมรับ/ไม่ยอมรับ/ยกเลิก/เพิ่มเอง/ลบ", () => {
  const d = (id: number, o: Partial<CodeDecision>): CodeDecision => ({
    id, an: "1", code: "E87.6", system: "ICD10", source: "rules", action: "accept", diagtype: "2", orType: null, opDate: null,
    provider: null, model: null, aiRunId: null, decidedBy: "u", decidedAt: "", ...o,
  });
  it("กดซ้ำ = ยกเลิก", () => {
    expect(decisionView([d(1, {}), d(2, { action: "undo" })]).state.get("dx|E876")).toBeUndefined();
    expect(decisionView([d(1, {}), d(2, { action: "reject" })]).state.get("dx|E876")).toBe("rejected");
  });
  it("เพิ่มเอง → ยอมรับทันที, ลบ → หายไป", () => {
    const add = d(1, { source: "manual", action: "add", code: "96.71", system: "ICD9CM", diagtype: null, orType: "NonOR" });
    expect(decisionView([add]).manual).toHaveLength(1);
    expect(decisionView([add]).state.get("proc|9671")).toBe("accepted");
    expect(decisionView([add, { ...add, id: 2, action: "remove" }]).manual).toHaveLength(0);
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
    __setGeminiProviderForTest(createGeminiProvider({ model: "m", generate: async () => AI_JSON }));
    const st = aiStatus();
    expect(st.active).toBe("rules");
    expect(st.reason).toContain("GEMINI_PAID_TIER");
  });
  it("gemini ผิดรูปแบบ 2 ครั้ง → fallback เป็นกฎหลักฐาน", async () => {
    process.env.AI_PROVIDER = "gemini";
    let calls = 0;
    __setGeminiProviderForTest(createGeminiProvider({ model: "m", generate: async () => { calls++; return "bad"; } }));
    const r = await runAnalyze(byAn("690001402"), "tester");
    expect(calls).toBe(2);
    expect(r.provider).toBe("rules");
    expect(r.fallbackReason).toContain("2 ครั้ง");
  });
  it("gemini สำเร็จรอบสอง → ใช้ผล gemini และส่งเฉพาะข้อความที่ตัดข้อมูลแล้ว", async () => {
    process.env.AI_PROVIDER = "gemini";
    const a = byAn("690001402");
    let calls = 0;
    let sent = "";
    const gen: GenerateFn = async (req) => {
      sent = req.prompt;
      return ++calls === 1 ? "bad" : AI_JSON;
    };
    __setGeminiProviderForTest(createGeminiProvider({ model: "test-model", generate: gen }));
    const r = await runAnalyze(a, "tester", "บันทึกของแพทย์");
    expect(r).toMatchObject({ provider: "gemini", model: "test-model", fallbackReason: null, draft: "ร่างสรุป" });
    expect(sent).toBe(promptFor(a).prompt);
    for (const s of [a.an, a.hn, a.patientName, a.admitDate, a.screen?.cc ?? "x", "บันทึกของแพทย์"]) expect(sent).not.toContain(s);
  });
  it("กฎหลักฐาน: รหัสใหม่ที่ไม่อ้างหลักฐาน → ตัดออก", async () => {
    process.env.AI_PROVIDER = "gemini";
    const noEv = JSON.stringify({ pdx: { code: "J44.1", evidence: ["Salbutamol NB"] }, secondary: [{ code: "I10", diagtype: 2, evidence: [] }] });
    __setGeminiProviderForTest(createGeminiProvider({ model: "m", generate: async () => noEv }));
    const r = await runAnalyze(byAn("690001402"), "tester");
    expect(r.items.map((i) => i.code)).toEqual(["J44.1"]);
    expect(r.droppedNoEvidence).toEqual(["I10"]);
  });
  it("workspace รวมผล AI ครั้งล่าสุดกับกฎ และคำนวณ DRG/RW", async () => {
    const ws = await buildWorkspace(byAn("690001402"), demoSource);
    expect(ws.aiRun?.provider).toBe("gemini");
    expect(ws.items.find((x) => x.code === "J44.1")?.source).toBe("ai+rule");
    expect(ws.prompt).toContain("Code this inpatient episode");
    expect(acceptedItems(ws.items, new Map())).toEqual([]);
  });
});
