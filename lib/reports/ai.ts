// lib/reports/ai.ts
// หน้า "ผลงาน AI": อัตรายอมรับ, รหัสที่แพทย์เพิ่มเอง (sensitivity), RW ที่เพิ่ม (ค่าประมาณ)

import type { AiRun, CodeDecision } from "@/lib/appdb/types";
import { buildFinalCodes, latestDecisions } from "@/lib/coding/final";
import { estimateForCodes } from "@/lib/drg/caseEstimate";
import { nhsoRatePerAdjRw } from "@/lib/env";
import type { PatientSource } from "@/lib/patients/types";
import type { SuggestResult } from "@/lib/ai/types";
import type { AiPerfGroup, AiPerfReport } from "./types";

const RW_CASE_CAP = 200;

function rate(a: number, b: number): number | null {
  return a + b ? Math.round((a / (a + b)) * 1000) / 1000 : null;
}

function top(codes: string[], n = 10) {
  const m = new Map<string, number>();
  for (const c of codes) m.set(c, (m.get(c) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([code, k]) => ({ code, n: k }));
}

export async function buildAiReport(
  runs: AiRun[],
  decisions: CodeDecision[],
  source: PatientSource,
  from: string,
  to: string,
  allDecisionsFor: (an: string) => Promise<CodeDecision[]>,
): Promise<AiPerfReport> {
  const suggestRuns = runs.filter((r) => r.kind === "suggest");
  // ใช้ผลครั้งล่าสุดของแต่ละ AN เป็นตัวตั้ง
  const latestRun = new Map<string, AiRun>();
  for (const r of suggestRuns) latestRun.set(r.an, r);

  const latest = latestDecisions(decisions);
  const suggestedDecisions = [...latest.values()].filter((d) => d.source !== "manual");
  const manualAdds = [...latest.values()].filter((d) => d.source === "manual" && d.action === "add");

  const groups = new Map<string, AiPerfGroup>();
  const g = (key: string, label: string) => {
    const cur = groups.get(key) ?? { key, label, runs: 0, suggested: 0, accepted: 0, rejected: 0, pending: 0, acceptanceRate: null };
    groups.set(key, cur);
    return cur;
  };

  for (const r of suggestRuns) g(`${r.provider}|${r.model ?? ""}`, r.model ? `${r.provider} / ${r.model}` : r.provider).runs += 1;

  let pendingTotal = 0;
  for (const r of latestRun.values()) {
    const grp = g(`${r.provider}|${r.model ?? ""}`, r.model ? `${r.provider} / ${r.model}` : r.provider);
    const res = r.result as Pick<SuggestResult, "suggestions">;
    for (const s of res.suggestions ?? []) {
      grp.suggested += 1;
      const d = decisions
        .filter((x) => x.an === r.an && x.source !== "manual" && x.system === s.system && x.code === s.code)
        .sort((a, b) => b.id - a.id)[0];
      if (!d) {
        grp.pending += 1;
        pendingTotal += 1;
      }
    }
  }
  for (const d of suggestedDecisions) {
    const grp = g(`${d.provider ?? d.source}|${d.model ?? ""}`, d.model ? `${d.provider} / ${d.model}` : (d.provider ?? d.source));
    if (d.action === "accept") grp.accepted += 1;
    if (d.action === "reject") grp.rejected += 1;
  }
  const byProvider = [...groups.values()].map((x) => ({ ...x, acceptanceRate: rate(x.accepted, x.rejected) }));

  const accepted = suggestedDecisions.filter((d) => d.action === "accept");
  const rejected = suggestedDecisions.filter((d) => d.action === "reject");

  // RW ที่เพิ่ม: เทียบค่าประมาณ ก่อน (รหัส HOSxP) / หลัง (รวมรหัสที่ยืนยัน) ของแต่ละ AN
  const ans = [...new Set([...accepted, ...manualAdds].map((d) => d.an))];
  const capped = ans.length > RW_CASE_CAP;
  let gain = 0;
  let cases = 0;
  for (const an of ans.slice(0, RW_CASE_CAP)) {
    const a = await source.getAdmission(an);
    if (!a) continue;
    const all = await allDecisionsFor(an);
    const [before, after] = await Promise.all([
      estimateForCodes(source, buildFinalCodes(a, []), a.los),
      estimateForCodes(source, buildFinalCodes(a, all), a.los),
    ]);
    if (before.adjrw != null && after.adjrw != null) {
      gain += after.adjrw - before.adjrw;
      cases += 1;
    }
  }
  const adjRwGain = Math.round(gain * 10_000) / 10_000;

  return {
    from,
    to,
    totals: {
      key: "all",
      label: "ทั้งหมด",
      runs: suggestRuns.length,
      suggested: byProvider.reduce((s, x) => s + x.suggested, 0),
      accepted: accepted.length,
      rejected: rejected.length,
      pending: pendingTotal,
      acceptanceRate: rate(accepted.length, rejected.length),
      manualAdded: manualAdds.length,
      droppedNoEvidence: suggestRuns.reduce((s, r) => s + r.nDroppedNoEvidence, 0),
      notInCodebook: suggestRuns.reduce((s, r) => s + r.nNotInCodebook, 0),
      sensitivity: rate(accepted.length, manualAdds.length),
      fallbackRuns: suggestRuns.filter((r) => r.fallbackReason).length,
    },
    byProvider,
    topAccepted: top(accepted.map((d) => d.code)),
    topRejected: top(rejected.map((d) => d.code)),
    topManual: top(manualAdds.map((d) => d.code)),
    rw: {
      cases,
      adjRwGain,
      estimatedRevenueGain: Math.round(adjRwGain * nhsoRatePerAdjRw()),
      capped,
    },
  };
}
