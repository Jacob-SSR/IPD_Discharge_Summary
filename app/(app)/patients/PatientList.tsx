// คอลัมน์ซ้าย: รายชื่อ "รอสรุป · ยังไม่ลง PDx" / "ลงรหัสแล้ว" + จุดสถานะ + ตัวกรอง (ช่วงวัน admit/จำหน่ายแยกกัน, ช่วงด่วน, แพทย์ 3 แบบ, หอผู้ป่วย)
"use client";

import { useState } from "react";
import { nth } from "@/components/motion";
import { addDays, fiscalYearBE, fiscalYearRange, formatThaiDate, quickRange, todayIso } from "@/lib/date";
import type { ListItem } from "@/lib/patients/bundle";
import type { FilterOptions } from "@/lib/patients/types";

export interface ListFilter {
  basis: "discharge" | "admit";
  from: string;
  to: string;
  ward: string;
  docRole: "dischargeDoctor" | "admitDoctor" | "pdxDoctor";
  doctor: string;
  q: string;
}

const LEVEL_TITLE: Record<string, string> = {
  err: "ผลตรวจกฎ: ผิดพลาด",
  warn: "ผลตรวจกฎ: ควรตรวจ",
  info: "ผลตรวจกฎ: ข้อสังเกต",
  ok: "ผลตรวจกฎ: ผ่าน",
  pending: "ยังไม่ลง PDx",
};

function quick(key: string, today: string): { from: string; to: string } {
  if (key === "last30") return { from: addDays(today, -29), to: today };
  if (key === "fy") return fiscalYearRange(fiscalYearBE(today));
  return quickRange(key as Parameters<typeof quickRange>[0], today);
}

const CHIPS = [
  ["last7", "7 วัน"],
  ["last30", "30 วัน"],
  ["thisMonth", "เดือนนี้"],
  ["lastMonth", "เดือนก่อน"],
  ["fy", "ปีงบนี้"],
] as const;

export function PatientList({
  items,
  loading,
  error,
  cur,
  busyAn,
  onSelect,
  filter,
  onFilter,
  options,
}: {
  items: ListItem[];
  loading: boolean;
  error: string | null;
  cur: string | null;
  busyAn: string | null;
  onSelect: (an: string) => void;
  filter: ListFilter;
  onFilter: (f: ListFilter) => void;
  options: FilterOptions;
}) {
  const today = todayIso();
  const [q, setQ] = useState(filter.q);
  const pend = items.filter((i) => i.pending);
  const done = items.filter((i) => !i.pending);
  const activeChip = CHIPS.find(([k]) => {
    const r = quick(k, today);
    return r.from === filter.from && r.to === filter.to;
  })?.[0];
  const set = (p: Partial<ListFilter>) => onFilter({ ...filter, ...p });

  const row = (p: ListItem, i: number) => (
    <button
      key={p.an}
      type="button"
      className="pt"
      style={nth(Math.min(i, 12))}
      aria-current={p.an === cur}
      onClick={() => onSelect(p.an)}
    >
      <span className="n">{p.patientName}</span>
      <span className="st">
        <i className={`pip ${p.pending ? "warn" : p.level}`} title={LEVEL_TITLE[p.pending ? "pending" : p.level]} />
        {busyAn === p.an ? (
          <i className="pip busy" title="AI กำลังวิเคราะห์" />
        ) : (
          p.aiRan && <i className="pip ran" title="วิเคราะห์ด้วย AI แล้ว" />
        )}
      </span>
      <span className="d">
        <span className="mono">{p.pdx ?? (p.dischargeDate ? "รอสรุป" : "ยังนอนอยู่")}</span> · {p.ageYears ?? "-"} ปี · {p.wardName ?? p.wardCode ?? "-"}
      </span>
    </button>
  );

  return (
    <nav className="pane list" aria-label="รายชื่อผู้ป่วย">
      <div className="filters">
        <div className="chips" role="group" aria-label="ช่วงด่วน">
          {CHIPS.map(([k, label]) => (
            <button key={k} type="button" className="chip" aria-pressed={activeChip === k} onClick={() => set(quick(k, today))}>
              {label}
            </button>
          ))}
        </div>
        <form
          className="frow"
          onSubmit={(e) => {
            e.preventDefault();
            set({ q: /^[0-9]{1,15}$/.test(q.trim()) ? q.trim() : "" });
          }}
        >
          <input className="fin" type="search" placeholder="ค้นหา AN / HN แล้วกด Enter" value={q} onChange={(e) => setQ(e.target.value)} inputMode="numeric" />
        </form>
        <details>
          <summary>
            ตัวกรอง · {filter.basis === "admit" ? "รับไว้" : "จำหน่าย"} {formatThaiDate(filter.from)} – {formatThaiDate(filter.to)}
          </summary>
          <div className="mt-2 flex flex-col gap-1.5">
            <select className="fin" value={filter.basis} onChange={(e) => set({ basis: e.target.value as ListFilter["basis"] })} aria-label="ช่วงวันของ">
              <option value="discharge">ช่วงวันจำหน่าย</option>
              <option value="admit">ช่วงวันรับไว้ (admit)</option>
            </select>
            <div className="frow">
              <input className="fin" type="date" value={filter.from} max={filter.to} onChange={(e) => e.target.value && set({ from: e.target.value })} aria-label="ตั้งแต่" />
              <input className="fin" type="date" value={filter.to} min={filter.from} onChange={(e) => e.target.value && set({ to: e.target.value })} aria-label="ถึง" />
            </div>
            <select className="fin" value={filter.ward} onChange={(e) => set({ ward: e.target.value })} aria-label="หอผู้ป่วย">
              <option value="">ทุกหอผู้ป่วย</option>
              {options.wards.map((w) => (
                <option key={w.code} value={w.code}>{w.name}</option>
              ))}
            </select>
            <div className="frow">
              <select className="fin" value={filter.docRole} onChange={(e) => set({ docRole: e.target.value as ListFilter["docRole"] })} aria-label="บทบาทแพทย์">
                <option value="dischargeDoctor">แพทย์ผู้จำหน่าย</option>
                <option value="admitDoctor">แพทย์ผู้รับไว้</option>
                <option value="pdxDoctor">ผู้วินิจฉัยหลัก</option>
              </select>
              <select className="fin" value={filter.doctor} onChange={(e) => set({ doctor: e.target.value })} aria-label="แพทย์">
                <option value="">ทุกคน</option>
                {options.doctors.map((d) => (
                  <option key={d.code} value={d.code}>{d.name}</option>
                ))}
              </select>
            </div>
          </div>
        </details>
      </div>

      {error && <p className="hint px-2" style={{ color: "var(--red)" }}>{error}</p>}
      {loading && !items.length ? (
        <div className="p-2">
          <div className="skeleton" style={{ height: 40 }} />
          <div className="skeleton" style={{ height: 40 }} />
          <div className="skeleton" style={{ height: 40 }} />
        </div>
      ) : (
        <div style={{ opacity: loading ? 0.55 : 1, transition: "opacity .2s" }}>
          <div className="label grp-l">รอสรุป · ยังไม่ลง PDx ({pend.length})</div>
          <div className="stagger">{pend.map(row)}</div>
          <div className="label grp-l">ลงรหัสแล้ว ({done.length})</div>
          <div className="stagger">{done.map(row)}</div>
          {!items.length && <p className="hint px-2">ไม่พบผู้ป่วยในช่วงนี้</p>}
        </div>
      )}
    </nav>
  );
}
