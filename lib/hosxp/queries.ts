// lib/hosxp/queries.ts
// SQL อ่านอย่างเดียวสำหรับ HOSxP — ทุก query ผ่าน hosxpQuery() ซึ่งตรวจว่าเป็น SELECT
// ตาราง/ฟิลด์ที่ใช้ต้องตรงกับ lib/hosxp/schema.ts (scripts/check-schema.ts ใช้ตรวจ)

import { normalizeIcd10, normalizeIcd9 } from "@/lib/coding/icd";
import { addDays, normalizeDate, todayIso } from "@/lib/date";
import type {
  AdmissionDetail,
  AdmissionFilter,
  AdmissionRow,
  CodeRef,
  DiagType,
  FilterOptions,
  HistoricalGroup,
  RwRow,
  Sex,
} from "@/lib/patients/types";
import { hosxpQuery } from "./pool";

const LIST_LIMIT = 2000;

type Row = Record<string, unknown>;

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function ref(code: unknown, name: unknown): CodeRef | null {
  const c = str(code);
  return c ? { code: c, name: str(name) ?? c } : null;
}

function sex(v: unknown): Sex {
  const s = str(v);
  return s === "1" ? "M" : s === "2" ? "F" : "U";
}

function diagtype(v: unknown): DiagType {
  const s = str(v);
  return s === "1" || s === "2" || s === "3" || s === "4" || s === "5" ? s : "4";
}

// ── รายชื่อผู้ป่วยใน ──────────────────────────────────────────────────────────
const LIST_SELECT = `
SELECT i.an, i.hn, i.regdate, i.regtime, i.dchdate, i.dchtime,
       i.ward, w.name AS ward_name,
       i.admdoctor, da.name AS admdoctor_name,
       i.dch_doctor, dd.name AS dch_doctor_name,
       CONCAT(IFNULL(p.pname,''), IFNULL(p.fname,''), ' ', IFNULL(p.lname,'')) AS ptname,
       p.sex, s.age_y, s.drg, s.rw, s.adjrw,
       DATEDIFF(i.dchdate, i.regdate) AS los,
       (SELECT x.icd10 FROM iptdiag x WHERE x.an = i.an AND x.diagtype = '1' ORDER BY x.icd10 LIMIT 1) AS pdx,
       (SELECT x.doctor FROM iptdiag x WHERE x.an = i.an AND x.diagtype = '1' ORDER BY x.icd10 LIMIT 1) AS pdx_doctor,
       (SELECT dx.name FROM iptdiag x JOIN doctor dx ON dx.code = x.doctor
         WHERE x.an = i.an AND x.diagtype = '1' ORDER BY x.icd10 LIMIT 1) AS pdx_doctor_name
FROM ipt i
LEFT JOIN patient p ON p.hn = i.hn
LEFT JOIN an_stat s ON s.an = i.an
LEFT JOIN ward w ON w.ward = i.ward
LEFT JOIN doctor da ON da.code = i.admdoctor
LEFT JOIN doctor dd ON dd.code = i.dch_doctor`;

const NO_PDX = "NOT EXISTS (SELECT 1 FROM iptdiag x WHERE x.an = i.an AND x.diagtype = '1')";

export function buildListWhere(f: AdmissionFilter): { where: string; params: unknown[] } {
  const conds: string[] = [];
  const params: unknown[] = [];
  if (f.admitFrom) { conds.push("i.regdate >= ?"); params.push(f.admitFrom); }
  if (f.admitTo) { conds.push("i.regdate <= ?"); params.push(f.admitTo); }
  if (f.dischargeFrom) { conds.push("i.dchdate >= ?"); params.push(f.dischargeFrom); }
  if (f.dischargeTo) { conds.push("i.dchdate <= ?"); params.push(f.dischargeTo); }
  if (f.ward) { conds.push("i.ward = ?"); params.push(f.ward); }
  if (f.admitDoctor) { conds.push("i.admdoctor = ?"); params.push(f.admitDoctor); }
  if (f.dischargeDoctor) { conds.push("i.dch_doctor = ?"); params.push(f.dischargeDoctor); }
  if (f.pdxDoctor) {
    conds.push("EXISTS (SELECT 1 FROM iptdiag x WHERE x.an = i.an AND x.diagtype = '1' AND x.doctor = ?)");
    params.push(f.pdxDoctor);
  }
  if (f.q) { conds.push("(i.an = ? OR i.hn = ?)"); params.push(f.q, f.q); }
  if (f.pending) {
    // แท็บรอสรุปที่ไม่ได้เลือกช่วงวัน: จำกัด 1 ปีล่าสุด กันสแกน ipt ทั้งตาราง
    if (!f.admitFrom && !f.admitTo && !f.dischargeFrom && !f.dischargeTo && !f.q) {
      conds.push("i.regdate >= ?");
      params.push(addDays(todayIso(), -365));
    }
    const status = f.pendingStatus ?? "all";
    if (status === "noPdx") conds.push(NO_PDX);
    else if (status === "admitted") conds.push("i.dchdate IS NULL");
    else conds.push(`(${NO_PDX} OR i.dchdate IS NULL)`);
  }
  return { where: conds.length ? `WHERE ${conds.join(" AND ")}` : "", params };
}

function mapListRow(r: Row): AdmissionRow {
  return {
    an: String(r.an),
    hn: String(r.hn),
    patientName: str(r.ptname) ?? "",
    sex: sex(r.sex),
    ageYears: num(r.age_y),
    admitDate: normalizeDate(r.regdate) ?? "",
    admitTime: str(r.regtime),
    dischargeDate: normalizeDate(r.dchdate),
    dischargeTime: str(r.dchtime),
    wardCode: str(r.ward),
    wardName: str(r.ward_name),
    admitDoctor: ref(r.admdoctor, r.admdoctor_name),
    dischargeDoctor: ref(r.dch_doctor, r.dch_doctor_name),
    pdxDoctor: ref(r.pdx_doctor, r.pdx_doctor_name),
    // HOSxP เก็บรหัสแบบไม่มีจุด (J189) → แปลงเป็น J18.9 ให้ตรงกับ codebook/กฎ
    pdx: r.pdx == null ? null : normalizeIcd10(String(r.pdx)),
    los: num(r.los),
    drg: str(r.drg),
    rw: num(r.rw),
    adjrw: num(r.adjrw),
  };
}

export async function fetchAdmissions(f: AdmissionFilter): Promise<AdmissionRow[]> {
  const { where, params } = buildListWhere(f);
  const rows = await hosxpQuery<Row>(
    `${LIST_SELECT} ${where} ORDER BY i.regdate DESC, i.an DESC LIMIT ${LIST_LIMIT}`,
    params,
  );
  return rows.map(mapListRow);
}

// ── รายละเอียดราย AN ─────────────────────────────────────────────────────────
export async function fetchAdmission(an: string): Promise<AdmissionDetail | null> {
  const head = await hosxpQuery<Row>(
    `${LIST_SELECT.replace(
      "FROM ipt i",
      `, p.cid, p.birthday, p.hometel,
       CONCAT_WS(' ', NULLIF(p.addrpart,''), IF(IFNULL(p.moopart,'') = '', NULL, CONCAT('ม.', p.moopart)),
         (SELECT t.full_name FROM thaiaddress t WHERE t.addressid = CONCAT(p.chwpart, p.amppart, p.tmbpart) LIMIT 1)) AS address,
       pt.name AS pttype_name, i.dchstts, ds.name AS dchstts_name, i.dchtype, dt.name AS dchtype_name
FROM ipt i
LEFT JOIN pttype pt ON pt.pttype = i.pttype
LEFT JOIN dchstts ds ON ds.dchstts = i.dchstts
LEFT JOIN dchtype dt ON dt.dchtype = i.dchtype`,
    )} WHERE i.an = ? LIMIT 1`,
    [an],
  );
  if (!head.length) return null;
  const h = head[0];

  const [diag, oper, labs, drugs] = await Promise.all([
    hosxpQuery<Row>(
      `SELECT d.icd10, d.diagtype, d.doctor, doc.name AS doctor_name, c.name AS icd_name
       FROM iptdiag d
       LEFT JOIN doctor doc ON doc.code = d.doctor
       LEFT JOIN icd101 c ON c.code = d.icd10
       WHERE d.an = ? ORDER BY d.diagtype, d.icd10`,
      [an],
    ),
    hosxpQuery<Row>(
      `SELECT o.icd9, o.opdate, o.doctor, doc.name AS doctor_name, c.name AS icd_name
       FROM iptoprt o
       LEFT JOIN doctor doc ON doc.code = o.doctor
       LEFT JOIN icd9cm1 c ON c.code = o.icd9
       WHERE o.an = ? AND o.icd9 IS NOT NULL AND o.icd9 <> ''
       ORDER BY o.opdate, o.icd9`,
      [an],
    ),
    hosxpQuery<Row>(
      `SELECT h.order_date, o.lab_items_code, li.lab_items_name, o.lab_order_result,
              li.lab_items_unit, li.lab_items_normal_value
       FROM lab_head h
       JOIN lab_order o ON o.lab_order_number = h.lab_order_number
       LEFT JOIN lab_items li ON li.lab_items_code = o.lab_items_code
       WHERE h.vn = ? AND o.lab_order_result IS NOT NULL AND o.lab_order_result <> ''
       ORDER BY h.order_date, li.lab_items_name`,
      [an],
    ),
    hosxpQuery<Row>(
      `SELECT o.rxdate, o.icode, d.name, d.strength, d.units, o.qty
       FROM opitemrece o
       JOIN drugitems d ON d.icode = o.icode
       WHERE o.an = ?
       ORDER BY o.rxdate, d.name`,
      [an],
    ),
  ]);

  const row = mapListRow(h);
  return {
    ...row,
    cid: str(h.cid),
    birthday: normalizeDate(h.birthday),
    address: str(h.address),
    phone: str(h.hometel),
    pttypeName: str(h.pttype_name),
    dischargeStatus: ref(h.dchstts, h.dchstts_name),
    dischargeType: ref(h.dchtype, h.dchtype_name),
    diagnoses: diag.map((d) => ({
      icd10: normalizeIcd10(String(d.icd10 ?? "")),
      diagtype: diagtype(d.diagtype),
      name: str(d.icd_name),
      doctorCode: str(d.doctor),
      doctorName: str(d.doctor_name),
    })),
    procedures: oper.map((o) => ({
      icd9: normalizeIcd9(String(o.icd9 ?? "")),
      name: str(o.icd_name),
      opDate: normalizeDate(o.opdate),
      doctorCode: str(o.doctor),
      doctorName: str(o.doctor_name),
    })),
    labs: labs.map((l) => ({
      date: normalizeDate(l.order_date),
      code: String(l.lab_items_code ?? ""),
      name: str(l.lab_items_name) ?? String(l.lab_items_code ?? ""),
      value: String(l.lab_order_result ?? "").trim(),
      unit: str(l.lab_items_unit),
      normal: str(l.lab_items_normal_value),
    })),
    drugs: drugs.map((d) => ({
      date: normalizeDate(d.rxdate),
      code: String(d.icode ?? ""),
      name: str(d.name) ?? String(d.icode ?? ""),
      strength: str(d.strength),
      units: str(d.units),
      qty: num(d.qty),
    })),
  };
}

// ── ตัวเลือกตัวกรอง ──────────────────────────────────────────────────────────
export async function fetchFilterOptions(): Promise<FilterOptions> {
  // แพทย์: เฉพาะคนที่มีชื่อเป็นผู้รับไว้/ผู้จำหน่าย/ผู้วินิจฉัยหลักในรอบ 1 ปี (กันรายชื่อยาวเกิน)
  const since = addDays(todayIso(), -365);
  const [wards, doctors] = await Promise.all([
    hosxpQuery<Row>("SELECT ward, name FROM ward ORDER BY ward"),
    hosxpQuery<Row>(
      `SELECT d.code, d.name FROM doctor d
       WHERE d.code IN (
         SELECT i.admdoctor FROM ipt i WHERE i.regdate >= ?
         UNION SELECT i.dch_doctor FROM ipt i WHERE i.regdate >= ?
         UNION SELECT x.doctor FROM iptdiag x JOIN ipt i ON i.an = x.an
               WHERE i.regdate >= ? AND x.diagtype = '1'
       )
       ORDER BY d.name`,
      [since, since, since],
    ),
  ]);
  return {
    wards: wards.map((w) => ref(w.ward, w.name)).filter((x): x is CodeRef => x != null),
    doctors: doctors.map((d) => ref(d.code, d.name)).filter((x): x is CodeRef => x != null),
  };
}

// ── ผลจัดกลุ่มย้อนหลัง (ใช้ประมาณ RW) ────────────────────────────────────────
export async function fetchHistoricalGroups(
  pdx: string,
  from: string,
  to: string,
): Promise<HistoricalGroup[]> {
  const rows = await hosxpQuery<Row>(
    `SELECT s.drg, COUNT(*) AS n, AVG(s.rw) AS avg_rw, AVG(s.adjrw) AS avg_adjrw,
            AVG((SELECT COUNT(*) FROM iptdiag y WHERE y.an = s.an AND y.diagtype <> '1')) AS avg_sdx
     FROM an_stat s
     JOIN ipt i ON i.an = s.an
     JOIN iptdiag d ON d.an = s.an AND d.diagtype = '1'
     WHERE REPLACE(d.icd10, '.', '') = ? AND i.dchdate BETWEEN ? AND ?
       AND s.drg IS NOT NULL AND s.drg <> ''
     GROUP BY s.drg
     ORDER BY n DESC
     LIMIT 10`,
    [pdx.replace(/\./g, ""), from, to],
  );
  return rows.map((r) => ({
    drg: String(r.drg),
    n: Number(r.n),
    avgRw: num(r.avg_rw),
    avgAdjRw: num(r.avg_adjrw),
    hasOr: null,
    avgSdx: num(r.avg_sdx),
  }));
}

// ── รายงาน RW/CMI (RW จริงจาก an_stat) ───────────────────────────────────────
export async function fetchRwRows(from: string, to: string): Promise<RwRow[]> {
  const rows = await hosxpQuery<Row>(
    `SELECT i.an, i.dchdate, i.ward, w.name AS ward_name, i.dch_doctor, d.name AS dch_doctor_name,
            s.drg, s.rw, s.adjrw, DATEDIFF(i.dchdate, i.regdate) AS los
     FROM ipt i
     LEFT JOIN an_stat s ON s.an = i.an
     LEFT JOIN ward w ON w.ward = i.ward
     LEFT JOIN doctor d ON d.code = i.dch_doctor
     WHERE i.dchdate BETWEEN ? AND ?
     ORDER BY i.dchdate`,
    [from, to],
  );
  return rows.map((r) => ({
    an: String(r.an),
    dischargeDate: normalizeDate(r.dchdate) ?? "",
    wardCode: str(r.ward),
    wardName: str(r.ward_name),
    dischargeDoctor: ref(r.dch_doctor, r.dch_doctor_name),
    drg: str(r.drg),
    rw: num(r.rw),
    adjrw: num(r.adjrw),
    los: num(r.los),
  }));
}
