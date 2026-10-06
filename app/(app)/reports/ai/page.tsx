"use client";

import { BrainCircuit, CheckCheck, Hand, Scale, Target } from "lucide-react";
import { RangePicker, useReportRange } from "@/components/RangePicker";
import { ReportTable, type Column } from "@/components/ReportTable";
import { AiDisclaimer, ErrorBox, KpiCard, SectionCard, Spinner } from "@/components/ui";
import { useJson } from "@/lib/client/useJson";
import type { AiPerfGroup, AiPerfReport } from "@/lib/reports/types";

const pct = (x: number | null) => (x == null ? "-" : `${(x * 100).toFixed(1)}%`);

const providerCols: Column<AiPerfGroup>[] = [
  { key: "label", header: "Provider / รุ่น", cell: (g) => g.label },
  { key: "runs", header: "ครั้งที่เรียก", align: "right", cell: (g) => g.runs },
  { key: "sug", header: "รหัสที่เสนอ", align: "right", cell: (g) => g.suggested },
  { key: "acc", header: "ยอมรับ", align: "right", cell: (g) => g.accepted },
  { key: "rej", header: "ไม่ยอมรับ", align: "right", cell: (g) => g.rejected },
  { key: "pend", header: "ยังไม่ตัดสิน", align: "right", cell: (g) => g.pending },
  { key: "rate", header: "อัตรายอมรับ", align: "right", cell: (g) => <b>{pct(g.acceptanceRate)}</b> },
];

function TopList({ title, items }: { title: string; items: { code: string; n: number }[] }) {
  return (
    <SectionCard title={title}>
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">-</p>
      ) : (
        <ul className="flex flex-col gap-1 text-sm">
          {items.map((i) => (
            <li key={i.code} className="flex justify-between">
              <code className="font-semibold text-mint-800">{i.code}</code>
              <span className="tabular-nums text-slate-600">{i.n}</span>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

export default function AiReportPage() {
  const [range, setRange] = useReportRange();
  const { data, error } = useJson<AiPerfReport>(`/api/reports/ai?from=${range.from}&to=${range.to}`);

  return (
    <div className="flex flex-col gap-4">
      <SectionCard title="ผลงาน AI แนะนำรหัส" icon={BrainCircuit}>
        <AiDisclaimer className="mb-3" />
        <RangePicker value={range} onApply={setRange} />
      </SectionCard>
      {error && <ErrorBox message={error} />}
      {!data ? (
        !error && <Spinner />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard icon={CheckCheck} label="อัตรายอมรับ" value={pct(data.totals.acceptanceRate)} sub={`ยอมรับ ${data.totals.accepted} / ไม่ยอมรับ ${data.totals.rejected} · รอตัดสิน ${data.totals.pending}`} />
            <KpiCard
              icon={Target}
              label="Sensitivity"
              value={pct(data.totals.sensitivity)}
              sub={`ยอมรับ ÷ (ยอมรับ + แพทย์เพิ่มเอง ${data.totals.manualAdded})`}
              tone="slate"
            />
            <KpiCard icon={Hand} label="รหัสที่แพทย์เพิ่มเอง" value={data.totals.manualAdded} sub="รหัสที่ระบบหาไม่เจอ" tone="amber" />
            <KpiCard
              icon={Scale}
              label="AdjRW ที่เพิ่ม (ประมาณ)"
              value={`${data.rw.adjRwGain >= 0 ? "+" : ""}${data.rw.adjRwGain.toFixed(4)}`}
              sub={`${data.rw.cases} ราย · ≈ ${data.rw.estimatedRevenueGain.toLocaleString()} ฿${data.rw.capped ? " (คำนวณ 200 รายแรก)" : ""}`}
            />
          </div>
          <p className="text-xs text-slate-500">
            เรียก AI {data.totals.runs} ครั้ง · ใช้กฎแทน AI {data.totals.fallbackRuns} ครั้ง · ตัดรหัสที่ไม่มีหลักฐาน {data.totals.droppedNoEvidence} รหัส ·
            เสนอรหัสที่ไม่อยู่ใน codebook {data.totals.notInCodebook} รหัส · AdjRW ที่เพิ่มเป็นค่าประมาณจากผลจัดกลุ่มย้อนหลัง ไม่ใช่ grouper จริง
          </p>
          <SectionCard title="แยกตาม provider / รุ่น">
            <ReportTable columns={providerCols} rows={data.byProvider} rowKey={(g) => g.key} empty="ยังไม่มีการเรียก AI ในช่วงนี้" />
          </SectionCard>
          <div className="grid gap-4 md:grid-cols-3">
            <TopList title="รหัสที่ยอมรับบ่อย" items={data.topAccepted} />
            <TopList title="รหัสที่ไม่ยอมรับบ่อย" items={data.topRejected} />
            <TopList title="รหัสที่แพทย์เพิ่มเองบ่อย" items={data.topManual} />
          </div>
        </>
      )}
    </div>
  );
}
