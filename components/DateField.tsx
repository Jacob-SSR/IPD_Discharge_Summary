// components/DateField.tsx — ช่องวันที่ (เลือกแบบ ค.ศ. ของ browser) พร้อมแสดง พ.ศ. ใต้ช่อง
"use client";

import { formatThaiDate, isIsoDate } from "@/lib/date";
import { inputClass } from "./ui";

export function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-0.5 text-xs text-slate-500">
      {label}
      <input type="date" className={`${inputClass} py-1.5`} value={value} onChange={(e) => onChange(e.target.value)} />
      <span className="h-4 text-[11px] text-mint-700">{isIsoDate(value) ? formatThaiDate(value) : ""}</span>
    </label>
  );
}
