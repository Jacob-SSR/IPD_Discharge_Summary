"use client";

import { useState } from "react";
import { CircleCheck, CircleMinus, CircleX, PlugZap, RefreshCw, TriangleAlert } from "lucide-react";
import { buttonClass, ErrorBox, SectionCard, Spinner } from "@/components/ui";
import { useJson } from "@/lib/client/useJson";
import type { StatusCheck } from "@/lib/system/status";

const ICON = {
  ok: <CircleCheck size={18} className="text-mint-600" />,
  warn: <TriangleAlert size={18} className="text-amber-600" />,
  error: <CircleX size={18} className="text-rose-600" />,
  skip: <CircleMinus size={18} className="text-slate-400" />,
};

export default function SystemPage() {
  const [tick, setTick] = useState(0);
  const { data, error, loading } = useJson<{ checks: StatusCheck[] }>(`/api/system/status?t=${tick}`);
  const checks = loading ? null : (data?.checks ?? null);

  return (
    <SectionCard
      title="ตรวจการเชื่อมต่อ"
      icon={PlugZap}
      actions={
        <button className={buttonClass("secondary", "sm")} onClick={() => setTick((t) => t + 1)}>
          <RefreshCw size={14} /> ตรวจอีกครั้ง
        </button>
      }
    >
      {error && <ErrorBox message={error} />}
      {!checks && !error && <Spinner label="กำลังตรวจ…" />}
      {checks && (
        <ul className="divide-y divide-mint-50">
          {checks.map((c) => (
            <li key={c.key} className="flex items-start gap-3 py-3">
              <span className="mt-0.5">{ICON[c.state]}</span>
              <div>
                <div className="text-sm font-medium">{c.label}</div>
                <div className="text-xs text-slate-600">{c.detail}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-xs text-slate-500">
        แสดงเฉพาะสถานะ ไม่แสดงข้อมูลผู้ป่วย/รหัสผ่าน/API key · ตรวจตาราง/ฟิลด์ HOSxP ทั้งหมดด้วย <code>npm run check-schema</code> บนเครื่องใน LAN
      </p>
    </SectionCard>
  );
}
