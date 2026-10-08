"use client";

// เพิ่มรหัส ICD-10 / ICD-9-CM เอง (OR/Non-OR + วันที่) — กด Enter หรือปุ่ม "เพิ่ม"

import { useEffect, useState, type FormEvent } from "react";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import { DateField } from "@/components/DateField";
import { Badge, buttonClass, ErrorBox, inputClass, SectionCard } from "@/components/ui";
import type { CodeDecision, CodeSystem } from "@/lib/appdb/types";
import { latestDecisions } from "@/lib/coding/final";
import { fetchJson } from "@/lib/client/fetchJson";
import { useJson } from "@/lib/client/useJson";
import { formatThaiDate } from "@/lib/date";
import { DIAGTYPE_LABEL_TH, type DiagType, type OrType } from "@/lib/patients/types";

interface Lookup {
  code: string;
  validFormat: boolean;
  inCodebook: boolean | null;
  entry: { code: string; description: string } | null;
  matches: { code: string; description: string }[];
}

export function ManualCodes({
  an,
  admitDate,
  decisions,
  canDecide,
  onDecided,
}: {
  an: string;
  admitDate: string;
  decisions: CodeDecision[];
  canDecide: boolean;
  onDecided: (d: CodeDecision) => void;
}) {
  const [system, setSystem] = useState<CodeSystem>("ICD10");
  const [code, setCode] = useState("");
  const [diagtype, setDiagtype] = useState<DiagType>("2");
  const [orType, setOrType] = useState<OrType>("NonOR");
  const [opDate, setOpDate] = useState(admitDate);
  const [debounced, setDebounced] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const added = [...latestDecisions(decisions).values()].filter((d) => d.source === "manual" && d.action === "add");

  // ค้น codebook หลังหยุดพิมพ์ 200 ms
  useEffect(() => {
    const t = setTimeout(() => setDebounced(code.trim()), 200);
    return () => clearTimeout(t);
  }, [code]);
  const lookup = useJson<Lookup>(debounced ? `/api/codebook?system=${system}&q=${encodeURIComponent(debounced)}` : null).data;

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      onDecided(await fetchJson<CodeDecision>("/api/decisions", { method: "POST", body: JSON.stringify({ an, source: "manual", ...body }) }));
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    const ok = await post({
      action: "add",
      system,
      code,
      diagtype: system === "ICD10" ? diagtype : null,
      orType: system === "ICD9CM" ? orType : null,
      opDate: system === "ICD9CM" && opDate ? opDate : null,
    });
    if (ok) setCode("");
  }

  return (
    <SectionCard title="เพิ่มรหัสเอง" icon={Plus}>
      {canDecide ? (
        <form onSubmit={add} className="flex flex-col gap-2">
          <div className="flex gap-1 rounded-xl bg-mint-50 p-1 text-xs">
            {(["ICD10", "ICD9CM"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSystem(s)}
                className={`flex-1 rounded-lg px-2 py-1 ${system === s ? "bg-white font-medium text-mint-800 shadow-sm" : "text-slate-600"}`}
              >
                {s === "ICD10" ? "ICD-10 (การวินิจฉัย)" : "ICD-9-CM (หัตถการ)"}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-0.5 text-xs text-slate-500">
              รหัส
              <input
                className={`${inputClass} w-32 py-1.5 font-mono uppercase`}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder={system === "ICD10" ? "เช่น E87.6" : "เช่น 99.04"}
                list={`cb-${system}`}
              />
              <datalist id={`cb-${system}`}>
                {lookup?.matches.map((m) => (
                  <option key={m.code} value={m.code}>{m.description}</option>
                ))}
              </datalist>
            </label>
            {system === "ICD10" ? (
              <label className="flex flex-col gap-0.5 text-xs text-slate-500">
                ประเภท
                <select className={`${inputClass} py-1.5`} value={diagtype} onChange={(e) => setDiagtype(e.target.value as DiagType)}>
                  {(["1", "2", "3", "4", "5"] as DiagType[]).map((t) => (
                    <option key={t} value={t}>{t} {DIAGTYPE_LABEL_TH[t]}</option>
                  ))}
                </select>
              </label>
            ) : (
              <>
                <label className="flex flex-col gap-0.5 text-xs text-slate-500">
                  OR / Non-OR
                  <select className={`${inputClass} py-1.5`} value={orType} onChange={(e) => setOrType(e.target.value as OrType)}>
                    <option value="OR">OR</option>
                    <option value="NonOR">Non-OR</option>
                  </select>
                </label>
                <DateField label="วันที่ทำ" value={opDate} onChange={setOpDate} />
              </>
            )}
            <button className={buttonClass("primary")} disabled={busy || !code.trim()} type="submit">
              <Plus size={15} /> เพิ่ม
            </button>
          </div>
          {lookup && code.trim() && (
            <div className="text-xs">
              {!lookup.validFormat ? (
                <span className="flex items-center gap-1 text-rose-700"><AlertTriangle size={13} /> รูปแบบรหัสไม่ถูกต้อง</span>
              ) : lookup.inCodebook === false ? (
                <span className="flex items-center gap-1 font-medium text-amber-800"><AlertTriangle size={13} /> {lookup.code} ไม่พบใน codebook — ตรวจรหัสก่อนเพิ่ม</span>
              ) : lookup.entry ? (
                <span className="text-mint-800">{lookup.entry.code} · {lookup.entry.description}</span>
              ) : null}
            </div>
          )}
          {error && <ErrorBox message={error} />}
        </form>
      ) : (
        <p className="text-xs text-slate-500">บัญชีนี้ดูได้อย่างเดียว — เฉพาะแพทย์ที่ได้รับสิทธิ์ที่เพิ่มรหัสได้</p>
      )}

      {added.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5">
          {added.map((d) => (
            <li key={d.id} className="flex items-center gap-2 rounded-xl border border-mint-100 px-3 py-1.5 text-sm">
              <code className="font-semibold text-mint-800">{d.code}</code>
              {d.diagtype && <Badge>{DIAGTYPE_LABEL_TH[d.diagtype]}</Badge>}
              {d.orType && <Badge>{d.orType === "OR" ? "OR" : "Non-OR"}</Badge>}
              {d.opDate && <span className="text-xs text-slate-500">{formatThaiDate(d.opDate)}</span>}
              <span className="text-xs text-slate-400">โดย {d.decidedBy}</span>
              {canDecide && (
                <button
                  className="ml-auto rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-700"
                  title="ลบรหัสที่เพิ่มเอง"
                  onClick={() => post({ action: "remove", system: d.system, code: d.code })}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
