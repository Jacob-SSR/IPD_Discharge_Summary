"use client";

import { BarChart3, Banknote, Hospital, Scale, TriangleAlert } from "lucide-react";
import { RangePicker, useReportRange } from "@/components/RangePicker";
import { ReportTable, type Column } from "@/components/ReportTable";
import { ErrorBox, KpiCard, SectionCard, Spinner } from "@/components/ui";
import { useJson } from "@/lib/client/useJson";
import { formatThaiDate, formatThaiMonth } from "@/lib/date";
import type { RwGroup, RwReport } from "@/lib/reports/types";

const n4 = (x: number | null) => (x == null ? "-" : x.toFixed(4));

function groupColumns(label: string, fmtKey?: (g: RwGroup) => string): Column<RwGroup>[] {
  return [
    { key: "label", header: label, cell: (g) => (fmtKey ? fmtKey(g) : g.label) },
    { key: "n", header: "จำหน่าย (ราย)", align: "right", cell: (g) => g.n.toLocaleString() },
    { key: "nrw", header: "มี AdjRW", align: "right", cell: (g) => g.nWithRw.toLocaleString() },
    { key: "rw", header: "รวม RW", align: "right", cell: (g) => g.sumRw.toFixed(4) },
    { key: "adj", header: "รวม AdjRW", align: "right", cell: (g) => g.sumAdjRw.toFixed(4) },
    { key: "cmi", header: "CMI", align: "right", cell: (g) => <b>{n4(g.cmi)}</b> },
  ];
}

export default function RwReportPage() {
  const [range, setRange] = useReportRange();
  const { data, error } = useJson<RwReport>(`/api/reports/rw?from=${range.from}&to=${range.to}`);

  return (
    <div className="flex flex-col gap-4">
      <SectionCard title="รายงาน RW / CMI (RW จริงจาก an_stat)" icon={BarChart3}>
        <RangePicker value={range} onApply={setRange} />
      </SectionCard>
      {error && <ErrorBox message={error} />}
      {!data ? (
        !error && <Spinner />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard icon={Hospital} label="จำหน่าย" value={data.totals.n.toLocaleString()} sub={`${formatThaiDate(data.from)} – ${formatThaiDate(data.to)}`} />
            <KpiCard icon={Scale} label="CMI" value={n4(data.totals.cmi)} sub={`รวม AdjRW ${data.totals.sumAdjRw.toFixed(4)}`} />
            <KpiCard
              icon={Banknote}
              label="ประมาณการรายรับ สปสช."
              value={`${data.totals.estimatedRevenue.toLocaleString()} ฿`}
              sub={`AdjRW × ${data.totals.ratePerAdjRw.toLocaleString()} บาท (ไม่รวมเงื่อนไขสิทธิ/ปรับลด)`}
              tone="slate"
            />
            <KpiCard icon={TriangleAlert} label="ยังไม่มี DRG/AdjRW" value={data.totals.nMissingDrg.toLocaleString()} sub="ยังไม่ได้จัดกลุ่มใน HOSxP" tone={data.totals.nMissingDrg ? "amber" : "mint"} />
          </div>
          <SectionCard title="รายเดือน">
            <ReportTable columns={groupColumns("เดือน", (g) => formatThaiMonth(g.key))} rows={data.byMonth} rowKey={(g) => g.key} />
          </SectionCard>
          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="รายหอผู้ป่วย">
              <ReportTable columns={groupColumns("หอผู้ป่วย")} rows={data.byWard} rowKey={(g) => g.key} />
            </SectionCard>
            <SectionCard title="รายแพทย์ผู้จำหน่าย">
              <ReportTable columns={groupColumns("แพทย์")} rows={data.byDoctor} rowKey={(g) => g.key} />
            </SectionCard>
          </div>
        </>
      )}
    </div>
  );
}
