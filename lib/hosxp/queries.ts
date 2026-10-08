// lib/hosxp/queries.ts
// SQL อ่านอย่างเดียวสำหรับ HOSxP — ทุก query ผ่าน hosxpQuery() ซึ่งตรวจว่าเป็น SELECT
// ตาราง/ฟิลด์ที่ใช้ต้องตรงกับ lib/hosxp/schema.ts (scripts/check-schema.ts ใช้ตรวจ)

import { procClass } from "@/lib/coding/codebook";
import { normalizeIcd10, normalizeIcd9 } from "@/lib/coding/icd";
import { addDays, normalizeDate, todayIso } from "@/lib/date";
import { aggregateHistory, type GroupedCase } from "@/lib/drg/history";
import type {
  AdmissionCoding,
  AdmissionDetail,
  AdmissionFilter,
  AdmissionRow,
  CodeRef,
  DiagType,
  FilterOptions,
  GroupingHistory,
  RwRow,
  Screen,
  Sex,
} from "@/lib/patients/types";
import { resolveColumns, type ResolvedColumns } from "./columns";
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
// ฟิลด์ที่ ppc-hos-10667 ใช้กับ HOSxP จริงอยู่แล้ว: ipt.dch_doctor, an_stat.aid → thaiaddress.full_name,
// an_stat.pttype — ส่วนคอลัมน์ที่ต่างกันตามเวอร์ชันเลือกผ่าน resolveColumns() (lib/hosxp/columns.ts)

function listSelect(c: ResolvedColumns): string {
  const adm = c.admitDoctor ? `i.${c.admitDoctor}` : "NULL";
  const g = c.grouper;
  return `
SELECT i.an, i.hn, i.regdate, i.regtime, i.dchdate, i.dchtime,
       i.ward, w.name AS ward_name,
       ${adm} AS admdoctor, da.name AS admdoctor_name,
       i.dch_doctor, dd.name AS dch_doctor_name, i.dchtype, dt.name AS dchtype_name,
       CONCAT(IFNULL(p.pname,''), IFNULL(p.fname,''), ' ', IFNULL(p.lname,'')) AS ptname,
       p.sex, s.age_y, ${g.drg ?? "NULL"} AS drg, ${g.rw ?? "NULL"} AS rw, ${g.adjrw ?? "NULL"} AS adjrw,
       DATEDIFF(i.dchdate, i.regdate) AS los,
       (SELECT x.icd10 FROM iptdiag x WHERE x.an = i.an AND x.diagtype = '1' ORDER BY x.icd10 LIMIT 1) AS pdx,
       (SELECT x.doctor FROM iptdiag x WHERE x.an = i.an AND x.diagtype = '1' ORDER BY x.icd10 LIMIT 1) AS pdx_doctor,
       (SELECT dx.name FROM iptdiag x JOIN doctor dx ON dx.code = x.doctor
         WHERE x.an = i.an AND x.diagtype = '1' ORDER BY x.icd10 LIMIT 1) AS pdx_doctor_name`;
}

function listFrom(c: ResolvedColumns): string {
  return `
FROM ipt i
LEFT JOIN patient p ON p.hn = i.hn
LEFT JOIN an_stat s ON s.an = i.an
LEFT JOIN ward w ON w.ward = i.ward
LEFT JOIN doctor da ON da.code = ${c.admitDoctor ? `i.${c.admitDoctor}` : "NULL"}
LEFT JOIN doctor dd ON dd.code = i.dch_doctor
LEFT JOIN dchtype dt ON dt.dchtype = i.dchtype`;
}

const NO_PDX = "NOT EXISTS (SELECT 1 FROM iptdiag x WHERE x.an = i.an AND x.diagtype = '1')";

export function buildListWhere(
  f: AdmissionFilter,
  c: Pick<ResolvedColumns, "admitDoctor">,
): { where: string; params: unknown[] } {
  const conds: string[] = [];
  const params: unknown[] = [];
  if (f.admitFrom) { conds.push("i.regdate >= ?"); params.push(f.admitFrom); }
  if (f.admitTo) { conds.push("i.regdate <= ?"); params.push(f.admitTo); }
  if (f.dischargeFrom) { conds.push("i.dchdate >= ?"); params.push(f.dischargeFrom); }
  if (f.dischargeTo) { conds.push("i.dchdate <= ?"); params.push(f.dischargeTo); }
  if (f.ward) { conds.push("i.ward = ?"); params.push(f.ward); }
  if (f.admitDoctor) {
    // ไม่มีคอลัมน์แพทย์ผู้รับไว้ใน HOSxP นี้ → กรองแล้วไม่พบใคร (ไม่เงียบๆ คืนทุกคน)
    if (c.admitDoctor) { conds.push(`i.${c.admitDoctor} = ?`); params.push(f.admitDoctor); }
    else conds.push("1 = 0");
  }
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
    dischargeType: ref(r.dchtype, r.dchtype_name),
    drg: str(r.drg),
    rw: num(r.rw),
    adjrw: num(r.adjrw),
  };
}

export async function fetchAdmissions(f: AdmissionFilter): Promise<AdmissionRow[]> {
  const c = await resolveColumns();
  const { where, params } = buildListWhere(f, c);
  const rows = await hosxpQuery<Row>(
    `${listSelect(c)} ${listFrom(c)} ${where} ORDER BY i.regdate DESC, i.an DESC LIMIT ${LIST_LIMIT}`,
    params,
  );
  return rows.map(mapListRow);
}

/** รหัสหัตถการที่มี extension code ต่อท้าย (เช่น 990401) → 99.04 + ext "01" */
export function splitIcd9(raw: string): { icd9: string; ext: string | null } {
  const digits = raw.replace(/[\s.]/g, "");
  if (/^[0-9]{5,8}$/.test(digits)) return { icd9: normalizeIcd9(digits.slice(0, 4)), ext: digits.slice(4) };
  return { icd9: normalizeIcd9(raw), ext: null };
}

// ── รายละเอียดราย AN ─────────────────────────────────────────────────────────
export async function fetchAdmission(an: string): Promise<AdmissionDetail | null> {
  const c = await resolveColumns();
  const head = await hosxpQuery<Row>(
    `${listSelect(c)},
       p.cid, p.birthday, p.hometel,
       CONCAT_WS(' ', NULLIF(TRIM(p.addrpart),''),
         IF(IFNULL(TRIM(p.moopart),'') = '', NULL, CONCAT('ม.', TRIM(p.moopart))),
         t.full_name) AS address,
       pt.name AS pttype_name, i.dchstts, ds.name AS dchstts_name,
       ${c.iptVn ? "i.vn" : "NULL"} AS admit_vn, ${c.prediag ? `i.${c.prediag}` : "NULL"} AS prediag
     ${listFrom(c)}
     LEFT JOIN thaiaddress t ON t.addressid = s.aid
     LEFT JOIN pttype pt ON pt.pttype = s.pttype
     LEFT JOIN dchstts ds ON ds.dchstts = i.dchstts
     WHERE i.an = ? LIMIT 1`,
    [an],
  );
  if (!head.length) return null;
  const h = head[0];

  const opDate = c.opDate ? `DATE(o.${c.opDate})` : "NULL";
  const opDoctor = c.opDoctor ? `o.${c.opDoctor}` : "NULL";
  const rxDate = c.rxDate ? `o.${c.rxDate}` : "NULL";
  const labWhere = c.labHasAn ? "(h.an = ? OR h.vn = ?)" : "h.vn = ?";

  const vn = str(h.admit_vn);
  const screenCols = c.screen.map((x) => `sc.${x}`).join(", ");

  const [diag, oper, labs, drugs, screen, admitDx] = await Promise.all([
    hosxpQuery<Row>(
      `SELECT d.icd10, d.diagtype, d.doctor, doc.name AS doctor_name, cd.name AS icd_name
       FROM iptdiag d
       LEFT JOIN doctor doc ON doc.code = d.doctor
       LEFT JOIN icd101 cd ON cd.code = d.icd10
       WHERE d.an = ? ORDER BY d.diagtype, d.icd10`,
      [an],
    ),
    hosxpQuery<Row>(
      `SELECT o.icd9, ${opDate} AS opdate, ${opDoctor} AS doctor, doc.name AS doctor_name,
              COALESCE(cm.name, cm4.name) AS icd_name
       FROM iptoprt o
       LEFT JOIN doctor doc ON doc.code = ${opDoctor}
       LEFT JOIN icd9cm1 cm ON cm.code = o.icd9
       LEFT JOIN icd9cm1 cm4 ON cm4.code = LEFT(REPLACE(o.icd9, '.', ''), 4)
       WHERE o.an = ? AND o.icd9 IS NOT NULL AND o.icd9 <> ''
       ORDER BY opdate, o.icd9`,
      [an],
    ),
    hosxpQuery<Row>(
      `SELECT h.order_date, lo.lab_items_code, li.lab_items_name, lo.lab_order_result,
              li.lab_items_unit, li.lab_items_normal_value
       FROM lab_head h
       JOIN lab_order lo ON lo.lab_order_number = h.lab_order_number
       LEFT JOIN lab_items li ON li.lab_items_code = lo.lab_items_code
       WHERE ${labWhere} AND lo.lab_order_result IS NOT NULL AND lo.lab_order_result <> ''
       ORDER BY h.order_date, li.lab_items_name`,
      c.labHasAn ? [an, an] : [an],
    ),
    hosxpQuery<Row>(
      `SELECT ${rxDate} AS rxdate, o.icode, d.name, d.strength, d.units, o.qty
       FROM opitemrece o
       JOIN drugitems d ON d.icode = o.icode
       WHERE o.an = ?
       ORDER BY rxdate, d.name`,
      [an],
    ),
    vn && screenCols
      ? hosxpQuery<Row>(`SELECT ${screenCols} FROM opdscreen sc WHERE sc.vn = ? LIMIT 1`, [vn])
      : Promise.resolve([] as Row[]),
    vn
      ? hosxpQuery<Row>("SELECT d.icd10 FROM ovstdiag d WHERE d.vn = ? ORDER BY d.diagtype, d.icd10", [vn])
      : Promise.resolve([] as Row[]),
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
    diagnoses: diag.map((d) => ({
      icd10: normalizeIcd10(String(d.icd10 ?? "")),
      diagtype: diagtype(d.diagtype),
      name: str(d.icd_name),
      doctorCode: str(d.doctor),
      doctorName: str(d.doctor_name),
    })),
    procedures: oper.map((o) => {
      const { icd9, ext } = splitIcd9(String(o.icd9 ?? ""));
      return {
        icd9,
        ext,
        orType: procClass(icd9),
        name: str(o.icd_name),
        opDate: normalizeDate(o.opdate),
        doctorCode: str(o.doctor),
        doctorName: str(o.doctor_name),
      };
    }),
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
    screen: screen.length ? mapScreen(screen[0]) : null,
    prediag: str(h.prediag),
    admitDx: [...new Set(admitDx.map((d) => normalizeIcd10(String(d.icd10 ?? ""))).filter(Boolean))],
  };
}

/** HOSxP เก็บค่าที่ไม่ได้วัดเป็น 0 ไม่ใช่ NULL (ยืนยันจาก rca) → ถือว่าไม่มีค่า */
function vital(v: unknown): number | null {
  const n = num(v);
  return n == null || n === 0 ? null : n;
}

export function mapScreen(r: Row): Screen {
  return {
    cc: str(r.cc),
    hpi: str(r.hpi),
    pmh: str(r.pmh),
    bps: vital(r.bps),
    bpd: vital(r.bpd),
    pulse: vital(r.pulse),
    temperature: vital(r.temperature),
    rr: vital(r.rr),
    bw: vital(r.bw),
    height: vital(r.height),
  };
}

// ── ตัวเลือกตัวกรอง ──────────────────────────────────────────────────────────
export async function fetchFilterOptions(): Promise<FilterOptions> {
  // แพทย์: เฉพาะคนที่มีชื่อเป็นผู้รับไว้/ผู้จำหน่าย/ผู้วินิจฉัยหลักในรอบ 1 ปี (กันรายชื่อยาวเกิน)
  const since = addDays(todayIso(), -365);
  const c = await resolveColumns();
  const adm = c.admitDoctor ? `i.${c.admitDoctor}` : "i.dch_doctor";
  const [wards, doctors] = await Promise.all([
    hosxpQuery<Row>("SELECT ward, name FROM ward ORDER BY ward"),
    hosxpQuery<Row>(
      `SELECT d.code, d.name FROM doctor d
       WHERE d.code IN (
         SELECT ${adm} FROM ipt i WHERE i.regdate >= ?
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

// ── ผลจัดกลุ่มย้อนหลัง (ใช้ประมาณ DRG/RW แบบ 4 ระดับ) ───────────────────────
const HISTORY_LIMIT = 3000;

export async function fetchGroupingHistory(pdx: string, from: string, to: string): Promise<GroupingHistory> {
  const key = pdx.replace(/\./g, "").toUpperCase();
  const g = (await resolveColumns()).grouper;
  // ไม่มีคอลัมน์ DRG ทั้งใน ipt และ an_stat → ไม่มีผลจัดกลุ่มย้อนหลัง (หน้าจอแจ้ง "ข้อมูลย้อนหลังไม่พอประมาณ")
  if (!g.drg) return aggregateHistory(key, []);
  const cases = await hosxpQuery<Row>(
    `SELECT i.an, ${g.drg} AS drg, ${g.rw ?? "NULL"} AS rw
     FROM ipt i
     LEFT JOIN an_stat s ON s.an = i.an
     JOIN iptdiag d ON d.an = i.an AND d.diagtype = '1'
     WHERE REPLACE(d.icd10, '.', '') = ? AND i.dchdate BETWEEN ? AND ?
       AND ${g.drg} IS NOT NULL AND ${g.drg} <> ''
     ORDER BY i.dchdate DESC
     LIMIT ${HISTORY_LIMIT}`,
    [key, from, to],
  );
  const coding = await fetchCoding(cases.map((r) => String(r.an)));
  const grouped: GroupedCase[] = cases.map((r) => {
    const cd = coding[String(r.an)];
    return {
      drg: String(r.drg),
      rw: num(r.rw),
      sdx: (cd?.diagnoses ?? []).filter((x) => ["2", "3", "4"].includes(x.diagtype)).map((x) => x.icd10),
      hasOr: (cd?.procedures ?? []).some((x) => procClass(x.icd9) === "OR"),
    };
  });
  return aggregateHistory(key, grouped);
}

// ── รหัสที่ลงไว้ของหลาย AN (จุดสถานะในรายชื่อ / ผลจัดกลุ่มย้อนหลัง) ───────────
const IN_CHUNK = 500;

export async function fetchCoding(ans: string[]): Promise<Record<string, AdmissionCoding>> {
  const out: Record<string, AdmissionCoding> = {};
  const list = [...new Set(ans)].filter((a) => /^[0-9]{1,15}$/.test(a));
  for (const a of list) out[a] = { diagnoses: [], procedures: [] };
  for (let i = 0; i < list.length; i += IN_CHUNK) {
    const chunk = list.slice(i, i + IN_CHUNK);
    const ph = chunk.map(() => "?").join(",");
    const [diag, oper] = await Promise.all([
      hosxpQuery<Row>(`SELECT d.an, d.icd10, d.diagtype, d.doctor FROM iptdiag d WHERE d.an IN (${ph})`, chunk),
      hosxpQuery<Row>(
        `SELECT o.an, o.icd9 FROM iptoprt o WHERE o.an IN (${ph}) AND o.icd9 IS NOT NULL AND o.icd9 <> ''`,
        chunk,
      ),
    ]);
    for (const d of diag) {
      out[String(d.an)]?.diagnoses.push({
        icd10: normalizeIcd10(String(d.icd10 ?? "")),
        diagtype: diagtype(d.diagtype),
        doctorCode: str(d.doctor),
      });
    }
    for (const o of oper) out[String(o.an)]?.procedures.push({ icd9: splitIcd9(String(o.icd9 ?? "")).icd9 });
  }
  return out;
}

// ── รายงาน RW/CMI (RW จริงจาก grouper: ipt หรือ an_stat) ───────────────────────────────────────
export async function fetchRwRows(from: string, to: string): Promise<RwRow[]> {
  const g = (await resolveColumns()).grouper;
  const rows = await hosxpQuery<Row>(
    `SELECT i.an, i.dchdate, i.ward, w.name AS ward_name, i.dch_doctor, d.name AS dch_doctor_name,
            ${g.drg ?? "NULL"} AS drg, ${g.rw ?? "NULL"} AS rw, ${g.adjrw ?? "NULL"} AS adjrw,
            DATEDIFF(i.dchdate, i.regdate) AS los
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
