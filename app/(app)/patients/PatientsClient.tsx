"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ClipboardList, Hourglass, Search, X } from "lucide-react";
import { DateField } from "@/components/DateField";
import { ReportTable, type Column } from "@/components/ReportTable";
import { Badge, buttonClass, ErrorBox, inputClass, SectionCard, Spinner } from "@/components/ui";
import { useJson } from "@/lib/client/useJson";
import { addDays, formatThaiDate, QUICK_RANGES, quickRange, todayIso, type QuickRangeKey } from "@/lib/date";
import type { AdmissionRow, FilterOptions, PendingStatus } from "@/lib/patients/types";

const FILTER_KEYS = [
  "admitFrom", "admitTo", "dischargeFrom", "dischargeTo", "ward",
  "admitDoctor", "dischargeDoctor", "pdxDoctor", "q", "pending", "pendingStatus",
] as const;
type FilterKey = (typeof FILTER_KEYS)[number];
type FilterState = Record<FilterKey, string>;

function fromParams(sp: URLSearchParams): FilterState {
  const f = Object.fromEntries(FILTER_KEYS.map((k) => [k, sp.get(k) ?? ""])) as FilterState;
  // เปิดหน้าครั้งแรก: admit 30 วันล่าสุด
  if (!FILTER_KEYS.some((k) => sp.has(k))) {
    const today = todayIso();
    f.admitFrom = addDays(today, -29);
    f.admitTo = today;
  }
  return f;
}

function toQuery(f: FilterState): string {
  const sp = new URLSearchParams();
  for (const k of FILTER_KEYS) if (f[k]) sp.set(k, f[k]);
  return sp.toString();
}

export function PatientsClient() {
  const router = useRouter();
  const params = useSearchParams();
  const applied = useMemo(() => fromParams(new URLSearchParams(params.toString())), [params]);
  const appliedQuery = toQuery(applied);
  // ฟอร์มตัวกรองเริ่มจากค่าใน URL และรีเซ็ตเมื่อ URL เปลี่ยน
  const [draftState, setDraftState] = useState({ query: appliedQuery, value: applied });
  const draft = draftState.query === appliedQuery ? draftState.value : applied;
  const setDraft = (update: (d: FilterState) => FilterState) =>
    setDraftState({ query: appliedQuery, value: update(draft) });

  const options = useJson<FilterOptions>("/api/patients/options").data ?? { wards: [], doctors: [] };
  const list = useJson<{ rows: AdmissionRow[] }>(`/api/patients?${appliedQuery}`);
  const rows = list.data?.rows ?? null;
  const { error, loading } = list;

  const pending = applied.pending === "1";
  const apply = (f: FilterState) => router.replace(`/patients?${toQuery(f)}`);
  const set = (k: FilterKey, v: string) => setDraft((d) => ({ ...d, [k]: v }));

  function quick(target: "admit" | "discharge", key: QuickRangeKey) {
    const r = quickRange(key, todayIso());
    apply({ ...draft, [`${target}From`]: r.from, [`${target}To`]: r.to } as FilterState);
  }

  function setTab(isPending: boolean) {
    if (isPending) {
      // แท็บรอสรุปไม่จำกัดช่วงวัน (ผู้ป่วยที่ยังนอนอยู่อาจ admit นานแล้ว) — เลือกช่วงวันเพิ่มเองได้
      apply({ ...draft, admitFrom: "", admitTo: "", dischargeFrom: "", dischargeTo: "", pending: "1", pendingStatus: draft.pendingStatus || "all" });
    } else {
      const today = todayIso();
      apply({ ...draft, admitFrom: addDays(today, -29), admitTo: today, dischargeFrom: "", dischargeTo: "", pending: "", pendingStatus: "" });
    }
  }

  const columns: Column<AdmissionRow>[] = [
    { key: "an", header: "AN", cell: (r) => <span className="font-medium text-mint-800">{r.an}</span> },
    { key: "hn", header: "HN", cell: (r) => r.hn },
    { key: "name", header: "ชื่อ-สกุล", cell: (r) => r.patientName },
    { key: "age", header: "อายุ/เพศ", cell: (r) => `${r.ageYears ?? "-"} / ${r.sex === "M" ? "ช" : r.sex === "F" ? "ญ" : "-"}` },
    { key: "ward", header: "หอผู้ป่วย", cell: (r) => r.wardName ?? "-" },
    { key: "admit", header: "วันที่รับไว้", cell: (r) => formatThaiDate(r.admitDate) },
    {
      key: "dch",
      header: "วันที่จำหน่าย",
      cell: (r) => (r.dischargeDate ? formatThaiDate(r.dischargeDate) : <Badge tone="sky">ยังนอนอยู่</Badge>),
    },
    { key: "los", header: "LOS", align: "right", cell: (r) => r.los ?? "-" },
    { key: "pdx", header: "PDx", cell: (r) => (r.pdx ? <code>{r.pdx}</code> : <Badge tone="amber">ยังไม่มี PDx</Badge>) },
    { key: "dchdr", header: "แพทย์ผู้จำหน่าย", cell: (r) => r.dischargeDoctor?.name ?? "-" },
    { key: "adjrw", header: "AdjRW", align: "right", cell: (r) => (r.adjrw != null ? r.adjrw.toFixed(4) : "-") },
  ];

  const doctorSelect = (k: FilterKey, label: string) => (
    <label className="flex flex-col gap-0.5 text-xs text-slate-500">
      {label}
      <select className={`${inputClass} py-1.5`} value={draft[k]} onChange={(e) => set(k, e.target.value)}>
        <option value="">ทั้งหมด</option>
        {options.doctors.map((d) => (
          <option key={d.code} value={d.code}>{d.name}</option>
        ))}
      </select>
    </label>
  );

  const quickSelect = (target: "admit" | "discharge") => (
    <select
      className={`${inputClass} py-1 text-xs`}
      value=""
      onChange={(e) => e.target.value && quick(target, e.target.value as QuickRangeKey)}
      aria-label="ช่วงด่วน"
    >
      <option value="">ช่วงด่วน…</option>
      {QUICK_RANGES.map((q) => (
        <option key={q.key} value={q.key}>{q.label}</option>
      ))}
    </select>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <button className={buttonClass(pending ? "secondary" : "primary")} onClick={() => setTab(false)}>
          <ClipboardList size={15} /> ผู้ป่วยในทั้งหมด
        </button>
        <button className={buttonClass(pending ? "primary" : "secondary")} onClick={() => setTab(true)}>
          <Hourglass size={15} /> รอสรุป
        </button>
        {pending && (
          <div className="ml-2 flex gap-1 rounded-xl bg-mint-50 p-1 text-xs">
            {([["all", "ทั้งหมด"], ["noPdx", "ยังไม่มี PDx"], ["admitted", "ยังนอนอยู่"]] as [PendingStatus, string][]).map(([k, label]) => (
              <button
                key={k}
                className={`rounded-lg px-2.5 py-1 ${(applied.pendingStatus || "all") === k ? "bg-white font-medium text-mint-800 shadow-sm" : "text-slate-600"}`}
                onClick={() => apply({ ...draft, pending: "1", pendingStatus: k })}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      <SectionCard title="ตัวกรอง" icon={Search}>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            apply(draft);
          }}
        >
          <div className="grid gap-3 md:grid-cols-2">
            <fieldset className="rounded-xl border border-mint-100 p-3">
              <legend className="flex items-center gap-2 px-1 text-xs font-semibold text-mint-800">ช่วงวันที่รับไว้ (admit) {quickSelect("admit")}</legend>
              <div className="grid grid-cols-2 gap-2">
                <DateField label="ตั้งแต่" value={draft.admitFrom} onChange={(v) => set("admitFrom", v)} />
                <DateField label="ถึง" value={draft.admitTo} onChange={(v) => set("admitTo", v)} />
              </div>
            </fieldset>
            <fieldset className="rounded-xl border border-mint-100 p-3">
              <legend className="flex items-center gap-2 px-1 text-xs font-semibold text-mint-800">ช่วงวันที่จำหน่าย {quickSelect("discharge")}</legend>
              <div className="grid grid-cols-2 gap-2">
                <DateField label="ตั้งแต่" value={draft.dischargeFrom} onChange={(v) => set("dischargeFrom", v)} />
                <DateField label="ถึง" value={draft.dischargeTo} onChange={(v) => set("dischargeTo", v)} />
              </div>
            </fieldset>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {doctorSelect("dischargeDoctor", "แพทย์ผู้จำหน่าย")}
            {doctorSelect("admitDoctor", "แพทย์ผู้รับไว้")}
            {doctorSelect("pdxDoctor", "แพทย์ผู้วินิจฉัยหลัก")}
            <label className="flex flex-col gap-0.5 text-xs text-slate-500">
              หอผู้ป่วย
              <select className={`${inputClass} py-1.5`} value={draft.ward} onChange={(e) => set("ward", e.target.value)}>
                <option value="">ทั้งหมด</option>
                {options.wards.map((w) => (
                  <option key={w.code} value={w.code}>{w.name}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-0.5 text-xs text-slate-500">
              ค้นหา AN / HN
              <input className={`${inputClass} py-1.5`} inputMode="numeric" value={draft.q} onChange={(e) => set("q", e.target.value.replace(/\D/g, ""))} />
            </label>
          </div>
          <div className="flex gap-2">
            <button className={buttonClass("primary")} type="submit">
              <Search size={15} /> ค้นหา
            </button>
            <button
              type="button"
              className={buttonClass("ghost")}
              onClick={() => {
                const cleared = Object.fromEntries(FILTER_KEYS.map((k) => [k, ""])) as FilterState;
                apply({ ...cleared, pending: draft.pending, pendingStatus: draft.pendingStatus, admitFrom: addDays(todayIso(), -29), admitTo: todayIso() });
              }}
            >
              <X size={15} /> ล้างตัวกรอง
            </button>
          </div>
        </form>
      </SectionCard>

      <SectionCard
        title={pending ? "รอสรุป: ยังไม่มี PDx ใน iptdiag หรือยังนอนอยู่" : "รายชื่อผู้ป่วยใน"}
        actions={rows && <span className="text-xs text-slate-500">{rows.length.toLocaleString()} ราย</span>}
      >
        {error && <ErrorBox message={error} />}
        {loading && !rows ? (
          <Spinner />
        ) : (
          <div className={loading ? "opacity-50" : ""}>
            <ReportTable
              columns={columns}
              rows={rows ?? []}
              rowKey={(r) => r.an}
              empty="ไม่พบผู้ป่วยตามเงื่อนไข"
              onRowClick={(r) => router.push(`/patients/${r.an}`)}
            />
          </div>
        )}
      </SectionCard>
    </div>
  );
}
