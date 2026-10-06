"use client";

// Course in hospital — ร่างจาก AI/กฎ (ข้อมูลมีโครงสร้างเท่านั้น) แล้วแพทย์แก้ไขและบันทึกเอง

import { useState } from "react";
import { NotebookPen, Save, Sparkles } from "lucide-react";
import { AiDisclaimer, Badge, buttonClass, ErrorBox, SectionCard } from "@/components/ui";
import type { CourseResult } from "@/lib/ai/types";
import type { CourseText, DecisionSource } from "@/lib/appdb/types";
import { fetchJson } from "@/lib/client/fetchJson";
import { providerLabel } from "./SuggestionsPanel";

export function CoursePanel({
  an,
  saved,
  canDecide,
  text,
  onText,
  onSaved,
}: {
  an: string;
  saved: CourseText | null;
  canDecide: boolean;
  text: string;
  onText: (t: string) => void;
  onSaved: (c: CourseText) => void;
}) {
  const [source, setSource] = useState<DecisionSource>(saved?.source ?? "manual");
  const [draftInfo, setDraftInfo] = useState<CourseResult | null>(null);
  const [busy, setBusy] = useState<"draft" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dirty = text !== (saved?.text ?? "");

  async function draft() {
    if (text.trim() && !window.confirm("แทนที่ข้อความเดิมด้วยร่างใหม่?")) return;
    setBusy("draft");
    setError(null);
    try {
      const r = await fetchJson<CourseResult>("/api/ai/course", { method: "POST", body: JSON.stringify({ an }) });
      setDraftInfo(r);
      setSource(r.provider === "gemini" ? "ai" : "rules");
      onText(r.text);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    setBusy("save");
    setError(null);
    try {
      onSaved(await fetchJson<CourseText>("/api/course", { method: "PUT", body: JSON.stringify({ an, text, source }) }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <SectionCard
      title="Course in hospital"
      icon={NotebookPen}
      actions={
        canDecide && (
          <>
            <button className={buttonClass("secondary", "sm")} onClick={draft} disabled={busy != null}>
              <Sparkles size={14} /> {busy === "draft" ? "กำลังร่าง…" : "ร่างจากข้อมูล"}
            </button>
            <button className={buttonClass("primary", "sm")} onClick={save} disabled={busy != null || !dirty}>
              <Save size={14} /> บันทึก
            </button>
          </>
        )
      }
    >
      {draftInfo && (
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
          <span>ร่างโดย</span>
          <Badge tone={draftInfo.provider === "gemini" ? "violet" : "slate"}>{providerLabel(draftInfo.provider, draftInfo.model)}</Badge>
          {draftInfo.fallbackReason && <span className="text-amber-700">{draftInfo.fallbackReason}</span>}
        </div>
      )}
      {draftInfo && <AiDisclaimer className="mb-2" kind="course" />}
      <textarea
        className="h-48 w-full rounded-xl border border-mint-200 p-3 text-sm outline-none focus:border-mint-500 focus:ring-2 focus:ring-mint-100"
        value={text}
        onChange={(e) => onText(e.target.value)}
        readOnly={!canDecide}
        placeholder="สรุปการรักษาระหว่างนอนโรงพยาบาล…"
      />
      <div className="mt-1 flex justify-between text-[11px] text-slate-500">
        <span>ร่างใช้เฉพาะข้อมูลมีโครงสร้าง (รหัส, lab, ยา, หัตถการ) — แพทย์ต้องตรวจและแก้ไขก่อนบันทึก</span>
        {saved && <span>บันทึกล่าสุด {new Date(saved.updatedAt).toLocaleString("th-TH")} โดย {saved.updatedBy}</span>}
      </div>
      {dirty && canDecide && <p className="mt-1 text-xs text-amber-700">ยังไม่ได้บันทึก</p>}
      {error && <ErrorBox message={error} />}
    </SectionCard>
  );
}
