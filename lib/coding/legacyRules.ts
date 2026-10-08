// lib/coding/legacyRules.ts
// กฎหลักฐาน + ผลตรวจรหัส แบบโปรแกรมเดิม (สนามลอง AI ให้รหัส)
//   ruleHints()  → รหัสที่กฎเสนอจากข้อมูลในชาร์ต (แสดงก่อนใช้ AI และส่งให้ AI ตรวจต่อ)
//   chartAlerts() → ผลตรวจรหัสที่ลงไว้ใน HOSxP (จุดสีในรายชื่อ + รายการแจ้งเตือน)
// ข้อความ/ความมั่นใจตรงกับโปรแกรมเดิม — tests/legacy-rules.test.ts เทียบกับผลของโปรแกรมเดิมทั้ง 22 ราย
// ⚠️ เกณฑ์ตัวเลข (Hct < 30, Plt < 100, Cr > 1.5, FBS ≥ 200, นอน > 30 วัน) อนุมานจากผลของโปรแกรมเดิม
//    เพราะไม่มีซอร์สกฎตัวจริง — ต้องให้แพทย์/ผู้ให้รหัสยืนยัน (CLINICAL_REVIEWED ใน lib/ai/rules.config.ts)

import type { AdmissionDetail, DiagType } from "@/lib/patients/types";
import { checkCodeSet } from "./checks";

export type HintKind = "dx" | "proc";

export interface RuleHint {
  kind: HintKind;
  code: string;
  diagtype: number | null;
  reason: string;
  /** หลักฐานที่แสดงบนหน้าจอ (อาจมี free text เช่น CC — ต้องตัดก่อนส่ง AI) */
  evidence: string[];
  confidence: number;
  source: "rule";
  /** rule = จากข้อมูลในชาร์ต, admit = รหัสจาก ER/OPD ตอนรับไว้ */
  origin: "rule" | "admit";
}

export type AlertLevel = "err" | "warn" | "info";
export type ChartLevel = AlertLevel | "ok" | "pending";

export interface ChartAlert {
  level: AlertLevel;
  message: string;
}

type Lab = AdmissionDetail["labs"][number];

function num(v: string): number | null {
  const m = /^[<>]?\s*(-?\d+(?:\.\d+)?)/.exec(v.trim());
  return m ? Number(m[1]) : null;
}

/** ผล lab ที่ชื่อตรง pattern ทั้งหมด (ค่าเป็นตัวเลข) */
function labsOf(a: AdmissionDetail, re: RegExp): { lab: Lab; v: number }[] {
  return a.labs
    .filter((l) => re.test(l.name))
    .map((l) => ({ lab: l, v: num(l.value) }))
    .filter((x): x is { lab: Lab; v: number } => x.v != null);
}

function extreme(list: { lab: Lab; v: number }[], dir: "min" | "max") {
  if (!list.length) return null;
  return list.reduce((a, b) => (dir === "min" ? (b.v < a.v ? b : a) : b.v > a.v ? b : a));
}

const ev = (x: { lab: Lab }) => `${x.lab.name} ${x.lab.value}${x.lab.unit ? " " + x.lab.unit : ""}`;

const LAB = {
  k: /^(k|potassium)\b|\(k\)|^k\+?$/i,
  na: /^(na|sodium)\b|\(na\)|^na\+?$/i,
  hct: /hct|hematocrit|haematocrit/i,
  plt: /platelet|\bplt\b/i,
  cr: /^creatinine|^cr\b|creatinine/i,
  glu: /\bfbs\b|glucose|\bdtx\b|\bbs\b/i,
};

export function ruleHints(a: AdmissionDetail): RuleHint[] {
  const dx = a.diagnoses.map((d) => d.icd10);
  const px = a.procedures.map((p) => p.icd9);
  const has = (re: RegExp) => dx.some((c) => re.test(c));
  const drug = (re: RegExp) => a.drugs.find((d) => re.test(d.name));
  const out: RuleHint[] = [];
  // รหัสเดียวกันจากหลายกฎ → รวมเป็นรายการเดียว (เก็บเหตุผล/ความมั่นใจของตัวแรก รวมหลักฐาน) แบบโปรแกรมเดิม
  const add = (h: Omit<RuleHint, "source" | "origin"> & { origin?: RuleHint["origin"] }) => {
    const same = out.find((x) => x.kind === h.kind && x.code === h.code);
    if (same) same.evidence = [...new Set([...same.evidence, ...h.evidence])];
    else out.push({ origin: "rule", ...h, source: "rule" });
  };

  // โพแทสเซียมต่ำ
  const k = extreme(labsOf(a, LAB.k), "min");
  if (k && k.v < 3.5 && !dx.includes("E87.6")) {
    const kcl = drug(/kcl|potassium chloride/i);
    if (kcl) add({ kind: "dx", code: "E87.6", diagtype: 3, reason: "โพแทสเซียมต่ำ และได้รับการรักษาด้วย KCl", evidence: [ev(k), kcl.name], confidence: 0.85 });
    else add({ kind: "dx", code: "E87.6", diagtype: 2, reason: "โพแทสเซียมต่ำ — ลงรหัสได้เมื่อมีการรักษา/ติดตาม", evidence: [ev(k)], confidence: 0.5 });
  }
  // โซเดียมต่ำ
  const na = extreme(labsOf(a, LAB.na), "min");
  if (na && na.v < 135 && !dx.includes("E87.1")) {
    add({ kind: "dx", code: "E87.1", diagtype: 2, reason: "โซเดียมต่ำ — ลงรหัสได้เมื่อมีการรักษา/ติดตาม", evidence: [ev(na)], confidence: na.v < 130 ? 0.6 : 0.4 });
  }
  // โลหิตจาง
  const hct = extreme(labsOf(a, LAB.hct), "min");
  if (hct && hct.v < 30 && !has(/^D(5\d|6[0-4])/)) {
    const transfused = px.includes("99.04") || !!drug(/packed red|\bprc\b|\blprc\b/i);
    add(
      transfused
        ? { kind: "dx", code: "D64.9", diagtype: 2, reason: "ภาวะโลหิตจาง ที่ได้รับเลือด — ถ้าทราบชนิด (เช่น D62 เสียเลือดเฉียบพลัน) ให้ระบุเจาะจง", evidence: [ev(hct), "ได้รับเลือด (99.04 / PRC)"], confidence: 0.8 }
        : { kind: "dx", code: "D64.9", diagtype: 2, reason: "ภาวะโลหิตจาง — ถ้าทราบชนิด (เช่น D62 เสียเลือดเฉียบพลัน) ให้ระบุเจาะจง", evidence: [ev(hct)], confidence: 0.5 },
    );
  }
  // เกล็ดเลือดต่ำ (ยกเว้นไข้เลือดออก)
  const plt = extreme(labsOf(a, LAB.plt), "min");
  if (plt && plt.v < 100 && !has(/^(D69|A90|A91)/)) {
    add({ kind: "dx", code: "D69.6", diagtype: 2, reason: "เกล็ดเลือดต่ำ (ถ้าไม่ใช่ส่วนหนึ่งของโรคหลัก เช่น ไข้เลือดออก)", evidence: [ev(plt)], confidence: 0.5 });
  }
  // Creatinine สูง
  const cr = extreme(labsOf(a, LAB.cr), "max");
  if (cr && cr.v > 1.5 && !has(/^N1[789]/)) {
    add({ kind: "dx", code: "N17.9", diagtype: 2, reason: "Creatinine สูง — ตรวจสอบว่าเป็น AKI (N17.-) หรือ CKD (N18.-) จากค่า baseline", evidence: [ev(cr)], confidence: 0.4 });
  }
  // น้ำตาลสูง
  const dm = has(/^E1[0-4]/);
  const glu = extreme(labsOf(a, LAB.glu), "max");
  if (glu && glu.v >= 200 && !dm) {
    add({ kind: "dx", code: "R73.9", diagtype: 2, reason: "น้ำตาลในเลือดสูง — ถ้ามีประวัติเบาหวานให้ลง E11.- แทน", evidence: [ev(glu)], confidence: 0.4 });
  }
  // ได้อินซูลินแต่ไม่มีรหัสเบาหวาน
  const insulin = drug(/insulin/i);
  if (insulin && !dm) {
    add({
      kind: "dx",
      code: "E11.9",
      diagtype: 2,
      reason: "ได้รับอินซูลินแต่ไม่มีรหัสเบาหวาน — ตรวจสอบชนิดเบาหวาน",
      evidence: [insulin.name],
      confidence: 0.6,
    });
  }
  // บาดเจ็บแต่ไม่มีสาเหตุภายนอก (เลือกจากกลไกใน CC — รองรับหกล้ม)
  if (has(/^[ST]/) && !has(/^[VWXY]/) && a.screen?.cc && /ล้ม/.test(a.screen.cc)) {
    add({ kind: "dx", code: "W19", diagtype: 5, reason: "มีรหัสบาดเจ็บแต่ไม่มีรหัสสาเหตุภายนอก — เลือกรหัส V01-Y98 ให้ตรงกลไกการบาดเจ็บ", evidence: [`CC: ${a.screen.cc}`], confidence: 0.7 });
  }
  // คลอดแต่ไม่มีผลการคลอด
  if (has(/^O8[0-4]/) && !has(/^Z37/)) {
    add({ kind: "dx", code: "Z37.0", diagtype: 4, reason: "มีการคลอดแต่ไม่มีรหัสผลการคลอด (Z37.-) — ตรวจจำนวนและสถานะทารก", evidence: [], confidence: 0.75 });
  }
  // ยาพ่น / ออกซิเจน
  const neb = drug(/\bNB\b|nebul/i);
  if (neb && !px.includes("93.94")) {
    add({ kind: "proc", code: "93.94", diagtype: null, reason: "ได้รับยาพ่นผ่าน nebulizer", evidence: [neb.name], confidence: 0.6 });
  }
  const o2 = drug(/oxygen|\bO2\b/i);
  if (o2 && !px.includes("93.96")) {
    add({ kind: "proc", code: "93.96", diagtype: null, reason: "ได้รับออกซิเจนเสริม", evidence: [o2.name], confidence: 0.5 });
  }
  // รหัสจาก ER/OPD ตอนรับไว้ (เฉพาะรายที่ยังไม่มีการวินิจฉัยใน HOSxP)
  if (!a.diagnoses.length) {
    const why = a.prediag ? [`วินิจฉัยแรกรับ: ${a.prediag}`] : [];
    a.admitDx.forEach((code, i) =>
      add(
        i === 0
          ? { kind: "dx", code, diagtype: 1, reason: "รหัสจาก ER/OPD ตอนรับไว้ — ตรวจสอบว่ายังเป็นการวินิจฉัยหลักเมื่อสิ้นสุดการรักษาหรือไม่", evidence: why, confidence: 0.5, origin: "admit" }
          : { kind: "dx", code, diagtype: 2, reason: "รหัสจาก ER/OPD ตอนรับไว้ (โรคร่วม)", evidence: why, confidence: 0.4, origin: "admit" },
      ),
    );
  }
  return out;
}

const REFER = /transfer|refer|ส่งต่อ/i;
const AMA = /against|ไม่สมัครใจ/i;

/** ผลตรวจรหัสที่ลงไว้ (ข้อความแบบโปรแกรมเดิม + กฎ ICD-10 Vol.2 เพิ่มเติม) */
export function chartAlerts(a: AdmissionDetail | (Pick<AdmissionDetail, "diagnoses" | "los" | "dischargeDate" | "dischargeType" | "procedures">)): ChartAlert[] {
  const out: ChartAlert[] = [];
  const dx = a.diagnoses;
  const pdx = dx.find((d) => d.diagtype === "1");
  const codes = dx.map((d) => d.icd10);
  const has = (re: RegExp) => codes.some((c) => re.test(c));

  if (!pdx) out.push({ level: "err", message: "ไม่มีการวินิจฉัยหลัก (PDx)" });
  if (pdx && /^R/.test(pdx.icd10)) {
    out.push({ level: "warn", message: `PDx ${pdx.icd10} เป็นรหัสอาการ (R-code) — ตรวจสอบว่ามีการวินิจฉัยที่เจาะจงกว่านี้หรือไม่` });
  }
  if (has(/^[ST]/) && !has(/^[VWXY]/)) out.push({ level: "err", message: "มีรหัสการบาดเจ็บ (S/T) แต่ไม่มีรหัสสาเหตุภายนอก (V01-Y98)" });
  if (has(/^O8[0-4]/) && !has(/^Z37/)) out.push({ level: "warn", message: "มีรหัสการคลอด (O80-O84) แต่ไม่มีรหัสผลการคลอด (Z37.-)" });
  const dup = codes.filter((c, i) => codes.indexOf(c) !== i);
  for (const c of [...new Set(dup)]) out.push({ level: "warn", message: `รหัสวินิจฉัยซ้ำ: ${c}` });
  if (pdx && !pdx.doctorCode) out.push({ level: "warn", message: "ไม่ระบุแพทย์ผู้วินิจฉัย" });

  // กฎ ICD-10 Vol.2 ที่โปรแกรมเดิมไม่ได้แจ้ง (MB1, MB4, dagger/asterisk, sequelae, สาเหตุภายนอกเป็น PDx)
  if (pdx) {
    const extra = checkCodeSet(
      { diagnoses: dx.map((d) => ({ code: d.icd10, diagtype: d.diagtype as DiagType })), procedures: [] },
      undefined,
      { skipCodebook: true },
    );
    for (const i of extra) {
      if (["MB1", "MB4", "ASTERISK_AS_PDX", "ASTERISK_PAIR", "SEQUELAE_AS_PDX", "EXTERNAL_CAUSE_AS_PDX", "MB2"].includes(i.rule)) {
        out.push({ level: i.severity === "error" ? "err" : i.severity === "warning" ? "warn" : "info", message: i.message });
      }
    }
  }

  if (a.dischargeDate && a.los === 0) {
    out.push({ level: "info", message: "นอนโรงพยาบาล 0 วัน (LOS = 0) — ตรวจสอบเกณฑ์การรับไว้เป็นผู้ป่วยใน" });
  }
  if (a.los != null && a.los > 30) out.push({ level: "info", message: `นอนโรงพยาบาลนาน ${a.los} วัน` });
  const dt = a.dischargeType;
  if (dt && (dt.code === "4" || REFER.test(dt.name))) out.push({ level: "info", message: "จำหน่ายโดยการส่งต่อ (Refer) — ตรวจสอบใบส่งตัว" });
  if (dt && (dt.code === "2" || AMA.test(dt.name))) out.push({ level: "info", message: "จำหน่ายโดยไม่สมัครใจอยู่ (Against advice)" });
  return out;
}

/** สถานะจุดสีในรายชื่อ: ยังไม่มี PDx = pending, นอกนั้นตามระดับแจ้งเตือนสูงสุด */
export function chartLevel(a: Parameters<typeof chartAlerts>[0], alerts = chartAlerts(a)): ChartLevel {
  if (!a.diagnoses.some((d) => d.diagtype === "1")) return "pending";
  if (alerts.some((x) => x.level === "err")) return "err";
  if (alerts.some((x) => x.level === "warn")) return "warn";
  if (alerts.some((x) => x.level === "info")) return "info";
  return "ok";
}
