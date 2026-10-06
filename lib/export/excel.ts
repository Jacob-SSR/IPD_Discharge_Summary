// lib/export/excel.ts
// Export แบบฟอร์ม Discharge Summary เป็น Excel (exceljs) — วันที่แสดงเป็น พ.ศ.

import ExcelJS from "exceljs";
import type { CourseText } from "@/lib/appdb/types";
import type { FinalCode } from "@/lib/coding/final";
import { formatThaiDate, formatTime } from "@/lib/date";
import { DIAGTYPE_LABEL, type AdmissionDetail } from "@/lib/patients/types";

const MINT = "FFD6F0E0";
const MINT_DARK = "FF1A5233";

export async function dischargeSummaryWorkbook(
  a: AdmissionDetail,
  codes: FinalCode[],
  course: CourseText | null,
  hospital: string,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = hospital;
  const ws = wb.addWorksheet("Discharge Summary", {
    pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  ws.columns = [{ width: 24 }, { width: 16 }, { width: 46 }, { width: 18 }];

  const title = ws.addRow([`${hospital} — สรุปเวชระเบียนผู้ป่วยใน (Discharge Summary)`]);
  ws.mergeCells(`A${title.number}:D${title.number}`);
  title.font = { bold: true, size: 14, color: { argb: MINT_DARK } };
  ws.addRow([]);

  const info: [string, string][] = [
    ["ชื่อ-สกุล", a.patientName],
    ["HN / AN", `${a.hn} / ${a.an}`],
    ["เพศ / อายุ", `${a.sex === "M" ? "ชาย" : a.sex === "F" ? "หญิง" : "-"} / ${a.ageYears ?? "-"} ปี`],
    ["เลขบัตรประชาชน", a.cid ?? "-"],
    ["สิทธิการรักษา", a.pttypeName ?? "-"],
    ["หอผู้ป่วย", a.wardName ?? "-"],
    ["วันที่รับไว้", `${formatThaiDate(a.admitDate)} ${formatTime(a.admitTime)}`],
    ["วันที่จำหน่าย", a.dischargeDate ? `${formatThaiDate(a.dischargeDate)} ${formatTime(a.dischargeTime)}` : "ยังไม่จำหน่าย"],
    ["วันนอน (LOS)", a.los != null ? `${a.los} วัน` : "-"],
    ["แพทย์ผู้รับไว้", a.admitDoctor?.name ?? "-"],
    ["แพทย์ผู้จำหน่าย", a.dischargeDoctor?.name ?? "-"],
    ["สถานะ/ประเภทการจำหน่าย", `${a.dischargeStatus?.name ?? "-"} / ${a.dischargeType?.name ?? "-"}`],
  ];
  for (const [k, v] of info) {
    const r = ws.addRow([k, v]);
    ws.mergeCells(`B${r.number}:D${r.number}`);
    r.getCell(1).font = { bold: true };
  }

  const header = (cells: string[]) => {
    ws.addRow([]);
    const r = ws.addRow(cells);
    r.eachCell((c) => {
      c.font = { bold: true, color: { argb: MINT_DARK } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: MINT } };
    });
  };

  header(["การวินิจฉัย", "ICD-10", "ชื่อโรค", "ที่มา"]);
  for (const c of codes.filter((x) => x.system === "ICD10")) {
    ws.addRow([DIAGTYPE_LABEL[c.diagtype ?? "4"], c.code, c.name ?? "", c.origin === "hosxp" ? "HOSxP" : "แพทย์ยืนยัน"]);
  }
  header(["หัตถการ", "ICD-9-CM", "ชื่อหัตถการ", "วันที่"]);
  for (const c of codes.filter((x) => x.system === "ICD9CM")) {
    ws.addRow([c.orType === "OR" ? "OR" : c.orType === "NonOR" ? "Non-OR" : "-", c.code, c.name ?? "", formatThaiDate(c.opDate)]);
  }

  header(["Course in hospital", "", "", ""]);
  const cr = ws.addRow([course?.text ?? ""]);
  ws.mergeCells(`A${cr.number}:D${cr.number}`);
  cr.alignment = { wrapText: true, vertical: "top" };
  cr.height = Math.min(400, 18 * Math.max(3, Math.ceil((course?.text.length ?? 0) / 90)));

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}
