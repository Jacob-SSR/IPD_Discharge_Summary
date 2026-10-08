// Command palette (Ctrl/⌘ + K): กระโดดไปผู้ป่วย (ชื่อ/AN/HN/PDx) หรือสั่งงาน — ไม่มีคำสั่ง "ยอมรับรหัส" โดยตั้งใจ (กฎข้อ 6)
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ListItem } from "@/lib/patients/bundle";

export interface PaletteAction {
  id: string;
  label: string;
  hint?: string;
  disabled?: boolean;
  run: () => void;
}

type Row = { kind: "pt"; item: ListItem } | { kind: "act"; action: PaletteAction };

export function CommandPalette({
  open,
  onClose,
  items,
  actions,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  items: ListItem[];
  actions: PaletteAction[];
  onSelect: (an: string) => void;
}) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) window.setTimeout(() => input.current?.focus(), 0);
  }, [open]);

  const rows = useMemo<Row[]>(() => {
    const t = q.trim().toLowerCase();
    const acts = actions.filter((a) => !a.disabled && (!t || a.label.toLowerCase().includes(t)));
    const pts = items
      .filter((i) => !t || [i.patientName, i.an, i.hn, i.pdx ?? "", i.wardName ?? ""].some((x) => x.toLowerCase().includes(t)))
      .slice(0, 30);
    return [...acts.map((action) => ({ kind: "act", action }) as Row), ...pts.map((item) => ({ kind: "pt", item }) as Row)];
  }, [q, items, actions]);

  if (!open) return null;
  const cur = Math.min(sel, Math.max(0, rows.length - 1));

  function pick(r: Row | undefined) {
    if (!r) return;
    onClose();
    setQ("");
    setSel(0);
    if (r.kind === "pt") onSelect(r.item.an);
    else r.action.run();
  }

  return (
    <div className="cmdk-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()} role="presentation">
      <div className="cmdk" role="dialog" aria-modal="true" aria-label="ค้นหาและคำสั่ง">
        <input
          ref={input}
          value={q}
          placeholder="พิมพ์ชื่อผู้ป่วย, AN, HN, รหัส PDx หรือคำสั่ง…"
          onChange={(e) => {
            setQ(e.target.value);
            setSel(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setSel((cur + 1) % Math.max(1, rows.length));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setSel((cur - 1 + rows.length) % Math.max(1, rows.length));
            } else if (e.key === "Enter") {
              e.preventDefault();
              pick(rows[cur]);
            } else if (e.key === "Escape") onClose();
          }}
          aria-activedescendant={rows.length ? `cmdk-${cur}` : undefined}
        />
        <ul role="listbox">
          {rows.length === 0 && <li className="sect">ไม่พบ</li>}
          {rows.map((r, i) => {
            const first = i === 0 || rows[i - 1].kind !== r.kind;
            return (
              <FragmentRow key={r.kind === "pt" ? r.item.an : r.action.id} first={first} kind={r.kind}>
                <li
                  id={`cmdk-${i}`}
                  role="option"
                  aria-selected={i === cur}
                  onMouseEnter={() => setSel(i)}
                  onClick={() => pick(r)}
                >
                  {r.kind === "pt" ? (
                    <>
                      <i className={`pip ${r.item.pending ? "warn" : r.item.level}`} />
                      <span>{r.item.patientName}</span>
                      <span className="sub">
                        {r.item.pdx ?? (r.item.dischargeDate ? "รอสรุป" : "ยังนอนอยู่")} · AN {r.item.an}
                      </span>
                    </>
                  ) : (
                    <>
                      <span aria-hidden>›</span>
                      <span>{r.action.label}</span>
                      {r.action.hint && <span className="sub">{r.action.hint}</span>}
                    </>
                  )}
                </li>
              </FragmentRow>
            );
          })}
        </ul>
        <div className="foot">
          <span>↑↓ เลือก</span>
          <span>Enter เปิด</span>
          <span>Esc ปิด</span>
          <span style={{ marginLeft: "auto" }}>Alt + ↑/↓ เปลี่ยนผู้ป่วย</span>
        </div>
      </div>
    </div>
  );
}

function FragmentRow({ first, kind, children }: { first: boolean; kind: Row["kind"]; children: React.ReactNode }) {
  return (
    <>
      {first && <li className="sect" aria-hidden>{kind === "pt" ? "ผู้ป่วย" : "คำสั่ง"}</li>}
      {children}
    </>
  );
}
