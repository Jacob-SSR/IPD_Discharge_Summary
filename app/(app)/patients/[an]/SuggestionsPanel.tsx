"use client";

// คำแนะนำรหัส — ยอมรับ/ไม่ยอมรับ "ทีละรหัส" เท่านั้น (ไม่มีปุ่มยอมรับทั้งหมดโดยตั้งใจ)

import { useState } from "react";
import { AlertTriangle, BrainCircuit, Check, FileSearch, Sparkles, X } from "lucide-react";
import { AiDisclaimer, Badge, buttonClass, ErrorBox, SectionCard } from "@/components/ui";
import type { AiStatus } from "@/lib/ai";
import type { CheckedSuggestion, SuggestResult } from "@/lib/ai/types";
import type { CodeDecision } from "@/lib/appdb/types";
import { latestDecisions, suggestionState } from "@/lib/coding/final";
import { fetchJson } from "@/lib/client/fetchJson";
import { DIAGTYPE_LABEL_TH } from "@/lib/patients/types";

export function providerLabel(provider: string, model: string | null): string {
  if (provider === "gemini") return `Gemini${model ? ` · ${model}` : ""}`;
  return "engine แบบกฎ (rules)";
}

export function SuggestionsPanel({
  an,
  ai,
  suggest,
  decisions,
  canDecide,
  onSuggest,
  onDecided,
}: {
  an: string;
  ai: AiStatus;
  suggest: SuggestResult | null;
  decisions: CodeDecision[];
  canDecide: boolean;
  onSuggest: (r: SuggestResult) => void;
  onDecided: (d: CodeDecision) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const latest = latestDecisions(decisions);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      onSuggest(await fetchJson<SuggestResult>("/api/ai/suggest", { method: "POST", body: JSON.stringify({ an }) }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function decide(s: CheckedSuggestion, action: "accept" | "reject") {
    if (!suggest) return;
    const k = `${s.system}:${s.code}`;
    setSaving(k);
    setError(null);
    try {
      const d = await fetchJson<CodeDecision>("/api/decisions", {
        method: "POST",
        body: JSON.stringify({
          an,
          source: suggest.provider === "gemini" ? "ai" : "rules",
          action,
          system: s.system,
          code: s.code,
          aiRunId: suggest.runId,
        }),
      });
      onDecided(d);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(null);
    }
  }

  return (
    <SectionCard
      title="คำแนะนำรหัส"
      icon={BrainCircuit}
      actions={
        canDecide && (
          <button className={buttonClass("primary", "sm")} onClick={run} disabled={busy}>
            <Sparkles size={14} /> {busy ? "กำลังวิเคราะห์…" : suggest ? "ขอคำแนะนำใหม่" : "ขอคำแนะนำรหัส"}
          </button>
        )
      }
    >
      <AiDisclaimer className="mb-3" />
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
        <span>ตั้งค่าปัจจุบัน:</span>
        <Badge tone={ai.active === "gemini" ? "violet" : "slate"}>{providerLabel(ai.active, ai.model)}</Badge>
        {ai.reason && <span className="text-amber-700">{ai.reason}</span>}
      </div>
      {error && <ErrorBox message={error} />}
      {!canDecide && <p className="text-xs text-slate-500">เฉพาะแพทย์ (role DOCTOR) ที่ขอคำแนะนำและยืนยันรหัสได้</p>}

      {suggest && (
        <div className="flex flex-col gap-3">
          <div className="rounded-xl bg-mint-50 px-3 py-2 text-xs text-mint-800">
            ผลจาก <b>{providerLabel(suggest.provider, suggest.model)}</b> · {new Date(suggest.createdAt).toLocaleString("th-TH")}
            {suggest.fallbackReason && <div className="mt-1 text-amber-800">ใช้กฎแทน AI: {suggest.fallbackReason}</div>}
          </div>

          {suggest.suggestions.length === 0 && <p className="text-sm text-slate-500">ไม่มีรหัสที่แนะนำเพิ่มจากข้อมูลที่มี</p>}

          {suggest.suggestions.map((s) => {
            const state = suggestionState(latest, an, s.system, s.code);
            const k = `${s.system}:${s.code}`;
            return (
              <div
                key={k}
                className={`rounded-xl border p-3 ${
                  state === "accepted" ? "border-mint-300 bg-mint-50" : state === "rejected" ? "border-slate-200 bg-slate-50 opacity-70" : "border-mint-100"
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <code className="text-base font-bold text-mint-800">{s.code}</code>
                  <Badge tone="sky">{s.system === "ICD10" ? "ICD-10" : "ICD-9-CM"}</Badge>
                  {s.diagtype && <Badge>{DIAGTYPE_LABEL_TH[s.diagtype]}</Badge>}
                  {s.orType && <Badge>{s.orType === "OR" ? "OR" : "Non-OR"}</Badge>}
                  {state === "accepted" && <Badge tone="mint"><Check size={12} /> ยอมรับแล้ว</Badge>}
                  {state === "rejected" && <Badge tone="rose"><X size={12} /> ไม่ยอมรับ</Badge>}
                </div>
                <div className="mt-1 text-sm">{s.codebookDescription ?? s.description}</div>
                <div className="mt-1 text-xs text-slate-600">{s.rationale}</div>
                <ul className="mt-2 flex flex-wrap gap-1">
                  {s.evidenceLabels.map((e) => (
                    <li key={e} className="flex items-center gap-1 rounded-lg bg-white px-2 py-0.5 text-[11px] text-slate-700 ring-1 ring-mint-100">
                      <FileSearch size={11} /> {e}
                    </li>
                  ))}
                </ul>
                {s.warnings.length > 0 && (
                  <ul className="mt-2 flex flex-col gap-1">
                    {s.warnings.map((w) => (
                      <li key={w} className="flex items-center gap-1 text-xs font-medium text-amber-800">
                        <AlertTriangle size={13} /> {w}
                      </li>
                    ))}
                  </ul>
                )}
                {canDecide && (
                  <div className="mt-3 flex gap-2">
                    <button
                      className={buttonClass("primary", "sm")}
                      disabled={saving === k || state === "accepted"}
                      onClick={() => decide(s, "accept")}
                    >
                      <Check size={14} /> ยอมรับ
                    </button>
                    <button
                      className={buttonClass("danger", "sm")}
                      disabled={saving === k || state === "rejected"}
                      onClick={() => decide(s, "reject")}
                    >
                      <X size={14} /> ไม่ยอมรับ
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {suggest.droppedNoEvidence.length > 0 && (
            <p className="text-xs text-slate-500">
              ตัดออก {suggest.droppedNoEvidence.length} รหัส เพราะไม่อ้างหลักฐานในเวชระเบียน:{" "}
              {suggest.droppedNoEvidence.map((d) => d.code).join(", ")}
            </p>
          )}
        </div>
      )}
    </SectionCard>
  );
}
