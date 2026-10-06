"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { fiscalYearBE, fiscalYearRange, QUICK_RANGES, quickRange, todayIso, type QuickRangeKey } from "@/lib/date";
import { DateField } from "./DateField";
import { buttonClass, inputClass } from "./ui";

/** ช่วงวันที่สำหรับรายงาน (ค่าเริ่มต้น = ปีงบนี้) */
export function useReportRange() {
  const today = todayIso();
  return useState({ from: fiscalYearRange(fiscalYearBE(today)).from, to: today });
}

export function RangePicker({
  value,
  onApply,
}: {
  value: { from: string; to: string };
  onApply: (v: { from: string; to: string }) => void;
}) {
  const [draft, setDraft] = useState(value);
  const fy = fiscalYearBE(todayIso());
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onApply(draft);
      }}
    >
      <DateField label="ตั้งแต่ (วันที่จำหน่าย/บันทึก)" value={draft.from} onChange={(from) => setDraft((d) => ({ ...d, from }))} />
      <DateField label="ถึง" value={draft.to} onChange={(to) => setDraft((d) => ({ ...d, to }))} />
      <select
        className={`${inputClass} mb-4 py-1.5 text-xs`}
        value=""
        onChange={(e) => {
          const v = e.target.value;
          if (!v) return;
          const r = v.startsWith("fy") ? fiscalYearRange(Number(v.slice(2))) : quickRange(v as QuickRangeKey, todayIso());
          setDraft(r);
          onApply(r);
        }}
      >
        <option value="">ช่วงด่วน…</option>
        {QUICK_RANGES.map((q) => (
          <option key={q.key} value={q.key}>{q.label}</option>
        ))}
        <option value={`fy${fy - 1}`}>ปีงบ {fy - 1}</option>
      </select>
      <button className={`${buttonClass("primary")} mb-4`} type="submit">
        <Search size={15} /> แสดง
      </button>
    </form>
  );
}
