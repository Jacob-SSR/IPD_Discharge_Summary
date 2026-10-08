// lib/reports/ai.ts
// หน้า "ผลงาน AI" และตัวเลขหัวหน้าทำงาน: อัตรายอมรับ, รหัสที่แพทย์เพิ่มเอง (sensitivity), RW ที่เพิ่ม (ค่าประมาณ)
// นับจากสถานะล่าสุดของแต่ละรหัส (กดซ้ำ = ยกเลิก) แบบตัวนับของโปรแกรมเดิม

import { computeWorkspace } from "@/lib/ai";
import { decisionView } from "@/lib/ai/merge";
import type { AnalyzeResult } from "@/lib/ai/types";
import { appDb } from "@/lib/appdb";
import type { AiRun, CodeDecision } from "@/lib/appdb/types";
import { valOf } from "@/lib/drg/estimate";
import { nhsoRatePerAdjRw } from "@/lib/env";
import type { Tally } from "@/lib/patients/bundle";
import type { PatientSource } from "@/lib/patients/types";
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

function toResult(r: AiRun): AnalyzeResult {
  const x = r.result as Partial<AnalyzeResult>;
  return {
    runId: r.id,
    provider: r.provider as AnalyzeResult["provider"],
    model: r.model,
    fallbackReason: r.fallbackReason,
    items: x.items ?? [],
    remarks: x.remarks ?? [],
    draft: x.draft ?? "",
    droppedNoEvidence: x.droppedNoEvidence ?? [],
    secs: x.secs ?? 0,
    createdAt: r.createdAt,
  };
}

/** สถานะล่าสุดของรหัสทุกตัวในช่วง แยกราย AN */
function states(decisions: CodeDecision[]) {
  const byAn = new Map<string, CodeDecision[]>();
  for (const d of decisions) byAn.set(d.an, [...(byAn.get(d.an) ?? []), d]);
  const accepted: CodeDecision[] = [];
  const rejected: CodeDecision[] = [];
  const manual: CodeDecision[] = [];
  for (const list of byAn.values()) {
    const view = decisionView(list);
    const last = new Map<string, CodeDecision>();
    for (const d of [...list].sort((a, b) => a.id - b.id)) last.set(`${d.system}|${d.code.replace(/\./g, "")}`, d);
    for (const d of last.values()) {
      const k = `${d.system === "ICD10" ? "dx" : "proc"}|${d.code.toUpperCase().replace(/[^A-Z0-9]/g, "")}`;
      if (view.manual.some((m) => `${m.kind}|${m.code.toUpperCase().replace(/[^A-Z0-9]/g, "")}` === k)) manual.push(d);
      else if (view.state.get(k) === "accepted") accepted.push(d);
      else if (view.state.get(k) === "rejected") rejected.push(d);
    }
  }
  return { accepted, rejected, manual, ans: [...byAn.keys()] };
}

/** RW ที่ได้เพิ่มจากรหัสที่ยืนยัน: รายที่ลงรหัสแล้ว = AdjRW หลัง − ก่อน · รายรอสรุป = AdjRW ทั้งราย */
async function rwGain(source: PatientSource, ans: string[], runs: AiRun[]) {
  let gain = 0;
  let cases = 0;
  const db = appDb();
  for (const an of ans.slice(0, RW_CASE_CAP)) {
    const a = await source.getAdmission(an);
    if (!a) continue;
    const [decisions, course] = await Promise.all([db.listDecisions(an), db.getCourse(an)]);
    const mine = runs.filter((r) => r.an === an && r.kind === "suggest");
    const last = mine.length ? toResult(mine[mine.length - 1]) : null;
    const ws = await computeWorkspace(a, source, decisions, course, last);
    const st = ws.rw;
    if (st.delta) {
      gain += st.delta;
      cases += 1;
    } else if (!st.before && st.after) {
      gain += valOf(st.after) ?? 0;
      cases += 1;
    }
  }
  return { gain: Math.round(gain * 10_000) / 10_000, cases, capped: ans.length > RW_CASE_CAP };
}

export async function buildTally(source: PatientSource, from: string, to: string): Promise<Tally> {
  const db = appDb();
  const [runs, decisions] = await Promise.all([db.listAiRunsInRange(from, to), db.listDecisionsInRange(from, to)]);
  const s = states(decisions);
  const ans = [...new Set([...runs.filter((r) => r.kind === "suggest").map((r) => r.an), ...s.ans])];
  const rw = await rwGain(source, ans, runs);
  return {
    from,
    to,
    analyzed: new Set(runs.filter((r) => r.kind === "suggest" && r.provider === "gemini").map((r) => r.an)).size,
    accepted: s.accepted.length + s.manual.length,
    rejected: s.rejected.length,
    rate: rate(s.accepted.length + s.manual.length, s.rejected.length),
    rwGain: rw.gain,
    capped: rw.capped,
  };
}

export async function buildAiReport(source: PatientSource, from: string, to: string): Promise<AiPerfReport> {
  const db = appDb();
  const [runs, decisions] = await Promise.all([db.listAiRunsInRange(from, to), db.listDecisionsInRange(from, to)]);
  const suggestRuns = runs.filter((r) => r.kind === "suggest");
  const s = states(decisions);

  const groups = new Map<string, AiPerfGroup>();
  const g = (provider: string, model: string | null) => {
    const key = `${provider}|${model ?? ""}`;
    const cur = groups.get(key) ?? { key, label: model ? `${provider} / ${model}` : provider, runs: 0, suggested: 0, accepted: 0, rejected: 0, pending: 0, acceptanceRate: null };
    groups.set(key, cur);
    return cur;
  };
  for (const r of suggestRuns) g(r.provider, r.model).runs += 1;

  // ข้อเสนอของ AI ครั้งล่าสุดแต่ละ AN ที่ยังไม่ได้ตัดสิน
  const latestRun = new Map<string, AiRun>();
  for (const r of suggestRuns) latestRun.set(r.an, r);
  const decided = new Set([...s.accepted, ...s.rejected].map((d) => `${d.an}|${d.code}`));
  let pendingTotal = 0;
  for (const r of latestRun.values()) {
    const grp = g(r.provider, r.model);
    for (const it of toResult(r).items) {
      grp.suggested += 1;
      if (!decided.has(`${r.an}|${it.code}`)) {
        grp.pending += 1;
        pendingTotal += 1;
      }
    }
  }
  for (const d of s.accepted) g(d.provider ?? d.source, d.model).accepted += 1;
  for (const d of s.rejected) g(d.provider ?? d.source, d.model).rejected += 1;
  const byProvider = [...groups.values()].map((x) => ({ ...x, acceptanceRate: rate(x.accepted, x.rejected) }));

  const rw = await rwGain(source, [...new Set([...s.accepted, ...s.manual].map((d) => d.an))], runs);

  return {
    from,
    to,
    totals: {
      key: "all",
      label: "ทั้งหมด",
      runs: suggestRuns.length,
      suggested: byProvider.reduce((n, x) => n + x.suggested, 0),
      accepted: s.accepted.length,
      rejected: s.rejected.length,
      pending: pendingTotal,
      acceptanceRate: rate(s.accepted.length, s.rejected.length),
      manualAdded: s.manual.length,
      droppedNoEvidence: suggestRuns.reduce((n, r) => n + r.nDroppedNoEvidence, 0),
      notInCodebook: suggestRuns.reduce((n, r) => n + r.nNotInCodebook, 0),
      sensitivity: rate(s.accepted.length, s.manual.length),
      fallbackRuns: suggestRuns.filter((r) => r.fallbackReason).length,
    },
    byProvider,
    topAccepted: top(s.accepted.map((d) => d.code)),
    topRejected: top(s.rejected.map((d) => d.code)),
    topManual: top(s.manual.map((d) => d.code)),
    rw: { cases: rw.cases, adjRwGain: rw.gain, estimatedRevenueGain: Math.round(rw.gain * nhsoRatePerAdjRw()), capped: rw.capped },
  };
}
