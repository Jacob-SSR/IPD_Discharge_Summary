// แบบฟอร์ม Discharge Summary ขนาด A4 — พิมพ์/บันทึก PDF จาก browser (print CSS ใน globals.css)
// ⚠️ ยังไม่ได้เทียบรูปแบบกับ template ของโปรแกรมเดิม (legacy) เพราะยังไม่ได้รับไฟล์

import type { FinalCode } from "@/lib/coding/final";
import { formatThaiDate, formatThaiDateLong, formatTime, todayIso } from "@/lib/date";
import { DIAGTYPE_LABEL, type AdmissionDetail, type DiagType } from "@/lib/patients/types";

const DX_ORDER: DiagType[] = ["1", "2", "3", "4", "5"];

export function DischargeForm({
  a,
  codes,
  course,
  hospital,
  demo,
}: {
  a: AdmissionDetail;
  codes: FinalCode[];
  course: string;
  hospital: string;
  demo: boolean;
}) {
  const dx = codes.filter((c) => c.system === "ICD10");
  const px = codes.filter((c) => c.system === "ICD9CM");
  const orPx = px.filter((c) => c.orType === "OR");
  const nonOrPx = px.filter((c) => c.orType !== "OR");
  const sex = a.sex === "M" ? "ชาย" : a.sex === "F" ? "หญิง" : "-";

  return (
    <article className="a4-sheet mx-auto">
      <header className="mb-3 flex items-end justify-between border-b-2 border-[#1a5233] pb-2">
        <div>
          <div className="text-[17px] font-bold text-[#1a5233]">{hospital}</div>
          <div className="text-[15px] font-semibold">DISCHARGE SUMMARY · สรุปเวชระเบียนผู้ป่วยใน</div>
        </div>
        <div className="text-right text-[12px]">
          <div>
            HN <b>{a.hn}</b>
          </div>
          <div>
            AN <b>{a.an}</b>
          </div>
        </div>
      </header>

      <table className="mb-3">
        <tbody>
          <tr>
            <th className="w-[18%]">ชื่อ-สกุล</th>
            <td colSpan={3}>{a.patientName}</td>
          </tr>
          <tr>
            <th>เพศ / อายุ</th>
            <td className="w-[32%]">
              {sex} / {a.ageYears ?? "-"} ปี
            </td>
            <th className="w-[18%]">เลขบัตรประชาชน</th>
            <td>{a.cid ?? "-"}</td>
          </tr>
          <tr>
            <th>ที่อยู่</th>
            <td colSpan={3}>{a.address ?? "-"}</td>
          </tr>
          <tr>
            <th>หอผู้ป่วย</th>
            <td>{a.wardName ?? "-"}</td>
            <th>สิทธิการรักษา</th>
            <td>{a.pttypeName ?? "-"}</td>
          </tr>
          <tr>
            <th>วันที่รับไว้</th>
            <td>
              {formatThaiDate(a.admitDate)} {formatTime(a.admitTime)}
            </td>
            <th>วันที่จำหน่าย</th>
            <td>{a.dischargeDate ? `${formatThaiDate(a.dischargeDate)} ${formatTime(a.dischargeTime)}` : "ยังไม่จำหน่าย"}</td>
          </tr>
          <tr>
            <th>วันนอน (LOS)</th>
            <td>{a.los != null ? `${a.los} วัน` : "-"}</td>
            <th>แพทย์ผู้รับไว้</th>
            <td>{a.admitDoctor?.name ?? "-"}</td>
          </tr>
        </tbody>
      </table>

      <table className="mb-3">
        <thead>
          <tr>
            <th className="w-[22%]">Diagnosis</th>
            <th className="w-[13%]">ICD-10</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          {DX_ORDER.flatMap((t) => {
            const list = dx.filter((c) => (c.diagtype ?? "4") === t);
            if (!list.length && t !== "1") return [];
            if (!list.length) {
              return [
                <tr key={t}>
                  <td>{DIAGTYPE_LABEL[t]}</td>
                  <td />
                  <td className="h-6" />
                </tr>,
              ];
            }
            return list.map((c, i) => (
              <tr key={`${t}-${c.code}`}>
                <td>{i === 0 ? DIAGTYPE_LABEL[t] : ""}</td>
                <td className="font-semibold">{c.code}</td>
                <td>{c.name ?? ""}</td>
              </tr>
            ));
          })}
        </tbody>
      </table>

      <table className="mb-3">
        <thead>
          <tr>
            <th className="w-[22%]">Procedure</th>
            <th className="w-[13%]">ICD-9-CM</th>
            <th>Description</th>
            <th className="w-[17%]">Date</th>
          </tr>
        </thead>
        <tbody>
          {[["Operating room", orPx], ["Non-OR", nonOrPx]].map(([label, list]) => {
            const l = list as FinalCode[];
            if (!l.length) {
              return (
                <tr key={label as string}>
                  <td>{label as string}</td>
                  <td />
                  <td className="h-6" />
                  <td />
                </tr>
              );
            }
            return l.map((c, i) => (
              <tr key={c.code}>
                <td>{i === 0 ? (label as string) : ""}</td>
                <td className="font-semibold">{c.code}</td>
                <td>{c.name ?? ""}</td>
                <td>{formatThaiDate(c.opDate)}</td>
              </tr>
            ));
          })}
        </tbody>
      </table>

      <div className="mb-3">
        <div className="mb-1 font-semibold">Course in hospital</div>
        <div className="min-h-[60mm] whitespace-pre-wrap rounded border border-[#9fb5a8] px-2 py-1.5">{course}</div>
      </div>

      <table className="mb-8">
        <tbody>
          <tr>
            <th className="w-[22%]">Discharge status</th>
            <td>{a.dischargeStatus ? `${a.dischargeStatus.code} ${a.dischargeStatus.name}` : "-"}</td>
            <th className="w-[20%]">Discharge type</th>
            <td>{a.dischargeType ? `${a.dischargeType.code} ${a.dischargeType.name}` : "-"}</td>
          </tr>
        </tbody>
      </table>

      <div className="flex justify-end">
        <div className="w-[85mm] text-center">
          <div className="border-b border-dotted border-black pb-6" />
          <div className="mt-1">({a.dischargeDoctor?.name ?? "..................................................."})</div>
          <div>แพทย์ผู้สรุปเวชระเบียน</div>
          <div className="mt-1">วันที่ ......../......../............</div>
        </div>
      </div>

      <footer className="mt-6 flex justify-between border-t border-[#c9d8cf] pt-1 text-[10.5px] text-slate-500">
        <span>พิมพ์เมื่อ {formatThaiDateLong(todayIso())}</span>
        <span>{demo ? "โหมด DEMO — ข้อมูลสมมติ" : "ข้อมูลจาก HOSxP · รหัสผ่านการยืนยันโดยแพทย์"}</span>
      </footer>
    </article>
  );
}
