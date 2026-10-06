"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  AlertOctagon,
  AlertTriangle,
  ArrowLeft,
  Check,
  ClipboardCopy,
  FileSpreadsheet,
  ListChecks,
  Printer,
  Scale,
} from "lucide-react";
import { Badge, buttonClass, ErrorBox, SectionCard, Spinner } from "@/components/ui";
import type { CodeDecision } from "@/lib/appdb/types";
import { codesToClipboardText, type CodeOrigin, type FinalCode } from "@/lib/coding/final";
import { fetchJson } from "@/lib/client/fetchJson";
import type { GroupEstimate } from "@/lib/drg/estimate";
import type { CheckBundle, SummaryBundle } from "@/lib/patients/bundle";
import { DIAGTYPE_LABEL_TH } from "@/lib/patients/types";
import { CoursePanel } from "./CoursePanel";
import { DischargeForm } from "./DischargeForm";
import { ManualCodes } from "./ManualCodes";
import { SuggestionsPanel } from "./SuggestionsPanel";

const ORIGIN: Record<CodeOrigin, { label: string; tone: "slate" | "violet" | "sky" | "mint" }> = {
  hosxp: { label: "HOSxP", tone: "slate" },
  ai: { label: "ยืนยันจาก AI", tone: "violet" },
  rules: { label: "ยืนยันจากกฎ", tone: "sky" },
  manual: { label: "แพทย์เพิ่มเอง", tone: "mint" },
};

function fmt(n: number | null | undefined, d = 4) {
  return n == null ? "-" : n.toFixed(d);
}

export function SummaryClient({ an }: { an: string }) {
  const [bundle, setBundle] = useState<SummaryBundle | null>(null);
  const [check, setCheck] = useState<CheckBundle | null>(null);
  const [course, setCourse] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetchJson<SummaryBundle>(`/api/patients/${an}`)
      .then((b) => {
        setBundle(b);
        setCourse(b.course?.text ?? "");
      })
      .catch((e: Error) => setError(e.message));
  }, [an]);

  const refreshCheck = useCallback(() => {
    fetchJson<CheckBundle>("/api/coding/check", { method: "POST", body: JSON.stringify({ an }) })
      .then(setCheck)
      .catch((e: Error) => setError(e.message));
  }, [an]);

  // ตรวจรหัส/ประมาณ RW ใหม่ทุกครั้งที่มีการตัดสินใจเพิ่ม
  const nDecisions = bundle?.decisions.length;
  useEffect(() => {
    if (nDecisions != null) refreshCheck();
  }, [nDecisions, refreshCheck]);

  const onDecided = (d: CodeDecision) => setBundle((b) => (b ? { ...b, decisions: [...b.decisions, d] } : b));

  async function copy(text: string, key: string) {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }

  if (error && !bundle) return <ErrorBox message={error} />;
  if (!bundle) return <Spinner />;
  const a = bundle.admission;
  const codes: FinalCode[] = check?.final ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="no-print flex flex-wrap items-center gap-2">
        <Link href="/patients" className={buttonClass("ghost")}>
          <ArrowLeft size={15} /> รายชื่อ
        </Link>
        <h1 className="text-lg font-semibold text-mint-800">
          AN {a.an} · {a.patientName}
        </h1>
        <div className="ml-auto flex flex-wrap gap-2">
          <button className={buttonClass("secondary")} onClick={() => copy(codesToClipboardText(codes), "all")} disabled={!codes.length}>
            {copied === "all" ? <Check size={15} /> : <ClipboardCopy size={15} />} คัดลอกรหัสไปลง HOSxP
          </button>
          <a className={buttonClass("secondary")} href={`/api/patients/${a.an}/excel`}>
            <FileSpreadsheet size={15} /> Export Excel
          </a>
          <button className={buttonClass("primary")} onClick={() => window.print()}>
            <Printer size={15} /> พิมพ์ / บันทึก PDF
          </button>
        </div>
      </div>
      {error && <ErrorBox message={error} />}

      <div className="grid gap-4 xl:grid-cols-[auto_minmax(0,1fr)]">
        <div className="overflow-x-auto">
          <DischargeForm a={a} codes={codes} course={course} hospital={bundle.hospitalName} demo={bundle.ai.mode === "demo"} />
        </div>

        <div className="no-print flex min-w-0 flex-col gap-4">
          <SectionCard title="รหัสสุดท้าย (HOSxP + ที่แพทย์ยืนยัน)" icon={ListChecks}>
            {codes.length === 0 ? (
              <p className="text-sm text-slate-500">ยังไม่มีรหัส</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {codes.map((c) => (
                  <li key={`${c.system}:${c.code}`} className="flex items-center gap-2 text-sm">
                    <button
                      className="flex items-center gap-1 rounded-lg bg-mint-50 px-2 py-0.5 font-mono font-semibold text-mint-800 hover:bg-mint-100"
                      title="คัดลอกรหัส"
                      onClick={() => copy(c.code, c.code)}
                    >
                      {c.code} {copied === c.code ? <Check size={12} /> : <ClipboardCopy size={12} />}
                    </button>
                    <span className="shrink-0"><Badge>{c.system === "ICD10" ? DIAGTYPE_LABEL_TH[c.diagtype ?? "4"] : c.orType === "OR" ? "OR" : c.orType === "NonOR" ? "Non-OR" : "หัตถการ"}</Badge></span>
                    <span className="shrink-0"><Badge tone={ORIGIN[c.origin].tone}>{ORIGIN[c.origin].label}</Badge></span>
                    <span className="min-w-0 flex-1 truncate text-xs text-slate-600" title={c.name ?? undefined}>{c.name}</span>
                  </li>
                ))}
              </ul>
            )}
            {check && check.issues.length > 0 && (
              <ul className="mt-3 flex flex-col gap-1 border-t border-mint-100 pt-3">
                {check.issues.map((i, k) => (
                  <li key={k} className={`flex items-start gap-1.5 text-xs ${i.severity === "error" ? "text-rose-700" : "text-amber-800"}`}>
                    {i.severity === "error" ? <AlertOctagon size={13} className="mt-0.5 shrink-0" /> : <AlertTriangle size={13} className="mt-0.5 shrink-0" />}
                    {i.message}
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SuggestionsPanel
            an={a.an}
            ai={bundle.ai}
            suggest={bundle.suggest}
            decisions={bundle.decisions}
            canDecide={bundle.canDecide}
            onSuggest={(s) => setBundle((b) => (b ? { ...b, suggest: s } : b))}
            onDecided={onDecided}
          />

          <ManualCodes an={a.an} admitDate={a.admitDate} decisions={bundle.decisions} canDecide={bundle.canDecide} onDecided={onDecided} />

          <CoursePanel
            an={a.an}
            saved={bundle.course}
            canDecide={bundle.canDecide}
            text={course}
            onText={setCourse}
            onSaved={(c) => setBundle((b) => (b ? { ...b, course: c } : b))}
          />

          <SectionCard title="DRG / RW" icon={Scale}>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="rounded-xl bg-mint-50 p-3">
                <div className="text-xs text-slate-500">จริงจาก an_stat</div>
                <div className="font-semibold">DRG {a.drg ?? "-"}</div>
                <div className="text-xs">RW {fmt(a.rw)} · AdjRW {fmt(a.adjrw)}</div>
              </div>
              <EstimateBox title="ประมาณ: รหัส HOSxP" e={check?.estimate.before} />
              <EstimateBox title="ประมาณ: หลังยืนยัน" e={check?.estimate.after} compare={check?.estimate.before} />
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              ค่าประมาณจากผลจัดกลุ่มย้อนหลัง (PDx เดียวกัน) — ไม่ใช่ grouper จริง
              {!bundle.reference.tdrg.formulaVerified && " · สูตร AdjRW ยังไม่ได้ยืนยันกับโปรแกรมเดิม"}
              {bundle.reference.tdrg.isDemo && " · ตาราง TDRG เป็นค่าสมมติ (demo)"}
            </p>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

function EstimateBox({ title, e, compare }: { title: string; e?: GroupEstimate; compare?: GroupEstimate }) {
  const diff = e?.adjrw != null && compare?.adjrw != null ? e.adjrw - compare.adjrw : null;
  return (
    <div className="rounded-xl bg-slate-50 p-3" title={e?.note}>
      <div className="text-xs text-slate-500">{title}</div>
      <div className="font-semibold">DRG {e?.drg ?? "-"}</div>
      <div className="text-xs">AdjRW {fmt(e?.adjrw)}</div>
      {diff != null && diff !== 0 && (
        <div className={`text-xs font-semibold ${diff > 0 ? "text-mint-700" : "text-rose-700"}`}>
          {diff > 0 ? "+" : ""}
          {diff.toFixed(4)}
        </div>
      )}
      {e && <div className="mt-1 text-[10px] text-slate-400">{e.note}</div>}
    </div>
  );
}
