// components/ReportTable.tsx — ตารางรายงานกลาง (หัวตารางสีเขียว แถวสลับสี)
import type { ReactNode } from "react";
import { EmptyState } from "./ui";

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
}

export function ReportTable<T>({
  columns,
  rows,
  rowKey,
  empty = "ไม่มีข้อมูล",
  onRowClick,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  empty?: ReactNode;
  onRowClick?: (row: T) => void;
}) {
  if (!rows.length) return <EmptyState>{empty}</EmptyState>;
  const align = (a?: string) => (a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left");
  return (
    <div className="overflow-x-auto rounded-xl border border-mint-100">
      <table className="report-table w-full text-sm">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={`px-3 py-2 ${align(c.align)}`}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={rowKey(r)}
              onClick={onRowClick ? () => onRowClick(r) : undefined}
              className={onRowClick ? "cursor-pointer" : undefined}
            >
              {columns.map((c) => (
                <td key={c.key} className={`border-t border-mint-50 px-3 py-2 ${align(c.align)} ${c.className ?? ""}`}>
                  {c.cell(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
