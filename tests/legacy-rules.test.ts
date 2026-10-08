// เทียบกฎที่ port มากับผลของโปรแกรมเดิม (ข้อมูลสมมติ 22 ราย จากสนามลอง AI ให้รหัส)
import { describe, expect, it } from "vitest";
import { buildDemoAdmissions, DEMO_PATIENTS } from "@/lib/demo/data";
import { chartAlerts, chartLevel, ruleHints } from "@/lib/coding/legacyRules";

const admissions = buildDemoAdmissions("2026-10-08");
type LegacyHint = { kind: string; code: string; diagtype: number | null; reason: string; evidence: string[]; confidence: number; origin: string };

describe.each(DEMO_PATIENTS.map((p) => [p.an, p] as const))("AN %s", (an, p) => {
  const a = admissions.find((x) => x.an === an)!;
  it("ข้อเสนอจากกฎตรงกับโปรแกรมเดิม", () => {
    const pick = (h: LegacyHint) => ({ kind: h.kind, code: h.code, diagtype: h.diagtype, reason: h.reason, evidence: h.evidence, confidence: h.confidence, origin: h.origin });
    const key = (h: { kind: string; code: string; origin: string }) => `${h.kind}|${h.code}|${h.origin}`;
    const mine = ruleHints(a).map(pick).sort((x, y) => key(x).localeCompare(key(y)));
    const legacy = (p.legacy.hints as LegacyHint[]).map(pick).sort((x, y) => key(x).localeCompare(key(y)));
    expect(mine).toEqual(legacy);
  });
  it("ผลตรวจรหัสตรงกับโปรแกรมเดิม", () => {
    const legacy = p.legacy.alerts.map(([level, message]) => ({ level, message }));
    // กฎ ICD-10 Vol.2 ที่เพิ่ม (MB1/MB4/asterisk/sequelae) ไม่มีในโปรแกรมเดิม — เทียบเฉพาะข้อความแบบเดิม
    const mine = chartAlerts(a).filter((x) => !/^MB|asterisk|sequelae|สาเหตุภายนอก \(V01–Y98\) ใช้เป็นโรคหลัก/.test(x.message) || legacy.some((l) => l.message === x.message));
    expect(mine).toEqual(legacy);
    if (p.legacy.level !== "pending") expect(chartLevel(a)).toBe(p.legacy.level);
  });
});
