// lib/patients/types.ts
// โครงข้อมูลผู้ป่วยใน — ใช้ร่วมกันทั้งโหมด demo และโหมด hosxp
// วันที่เป็น ISO "YYYY-MM-DD" (ค.ศ.), เวลาเป็น "HH:MM:SS"

export type Sex = "M" | "F" | "U";

/**
 * ประเภทการวินิจฉัยตาม iptdiag.diagtype ของ HOSxP
 * 1 = โรคหลัก (PDx), 2 = โรคร่วม, 3 = โรคแทรก, 4 = อื่นๆ, 5 = สาเหตุภายนอก
 */
export type DiagType = "1" | "2" | "3" | "4" | "5";

export const DIAGTYPE_LABEL: Record<DiagType, string> = {
  "1": "Principal diagnosis",
  "2": "Comorbidity",
  "3": "Complication",
  "4": "Other diagnosis",
  "5": "External cause",
};

export const DIAGTYPE_LABEL_TH: Record<DiagType, string> = {
  "1": "การวินิจฉัยหลัก",
  "2": "โรคร่วม",
  "3": "โรคแทรกซ้อน",
  "4": "อื่น ๆ",
  "5": "สาเหตุภายนอก",
};

export type OrType = "OR" | "NonOR";

export interface CodeRef {
  code: string;
  name: string;
}

export interface Diagnosis {
  icd10: string;
  diagtype: DiagType;
  name: string | null;
  doctorCode: string | null;
  doctorName: string | null;
}

export interface Procedure {
  icd9: string;
  /** extension code ที่ต่อท้ายรหัสใน HOSxP (เช่น 990401 → "01") */
  ext?: string | null;
  name: string | null;
  opDate: string | null;
  doctorCode: string | null;
  doctorName: string | null;
  /** OR / Non-OR ตาม ICD-9-CM ฉบับ สรท. (null = ไม่ทราบ) */
  orType?: OrType | null;
}

export interface LabResult {
  date: string | null;
  code: string;
  name: string;
  /** ผลตามที่เก็บในระบบ (อาจเป็นข้อความ) */
  value: string;
  unit: string | null;
  normal: string | null;
}

export interface DrugOrder {
  date: string | null;
  code: string;
  name: string;
  strength: string | null;
  units: string | null;
  qty: number | null;
  /** วันสุดท้ายที่ได้รับ (กรณีรวมหลายวันเป็นรายการเดียว) */
  lastDate?: string | null;
}

/** ข้อมูลคัดกรองแรกรับ (opdscreen ของ visit ที่ admit) — CC/HPI/PMH เป็น free text ห้ามส่ง AI */
export interface Screen {
  cc: string | null;
  hpi: string | null;
  pmh: string | null;
  bps: number | null;
  bpd: number | null;
  pulse: number | null;
  temperature: number | null;
  rr: number | null;
  bw: number | null;
  height: number | null;
}

/** แถวในหน้ารายชื่อ */
export interface AdmissionRow {
  an: string;
  hn: string;
  patientName: string;
  sex: Sex;
  ageYears: number | null;
  admitDate: string;
  admitTime: string | null;
  dischargeDate: string | null;
  dischargeTime: string | null;
  wardCode: string | null;
  wardName: string | null;
  admitDoctor: CodeRef | null;
  dischargeDoctor: CodeRef | null;
  pdxDoctor: CodeRef | null;
  pdx: string | null;
  los: number | null;
  dischargeType: CodeRef | null;
  drg: string | null;
  rw: number | null;
  adjrw: number | null;
}

/** ข้อมูลเต็มสำหรับแบบฟอร์ม Discharge Summary */
export interface AdmissionDetail extends AdmissionRow {
  cid: string | null;
  birthday: string | null;
  address: string | null;
  phone: string | null;
  pttypeName: string | null;
  dischargeStatus: CodeRef | null;
  diagnoses: Diagnosis[];
  procedures: Procedure[];
  labs: LabResult[];
  drugs: DrugOrder[];
  screen: Screen | null;
  /** การวินิจฉัยแรกรับที่แพทย์พิมพ์ (free text — แสดงอย่างเดียว ห้ามส่ง AI) */
  prediag: string | null;
  /** รหัสที่ลงไว้ตอน ER/OPD ก่อนรับไว้ (ไม่ใช่การวินิจฉัยสุดท้าย) */
  admitDx: string[];
}

export type PendingStatus = "all" | "noPdx" | "admitted";

export interface AdmissionFilter {
  admitFrom?: string;
  admitTo?: string;
  dischargeFrom?: string;
  dischargeTo?: string;
  ward?: string;
  admitDoctor?: string;
  dischargeDoctor?: string;
  pdxDoctor?: string;
  /** ค้นหา AN / HN */
  q?: string;
  /** แท็บ "รอสรุป": ยังไม่มี PDx ใน iptdiag หรือยังนอนอยู่ */
  pending?: boolean;
  pendingStatus?: PendingStatus;
}

export interface FilterOptions {
  wards: CodeRef[];
  doctors: CodeRef[];
}

/** จำนวนเคส (DRG → จำนวน) */
export type DrgCounts = Record<string, number>;

/**
 * ผลจัดกลุ่มย้อนหลังของ PDx หนึ่งตัว แยก 4 ระดับ (แบบ rw_estimator.py ของโปรแกรมเดิม)
 *   t1: "<หมวด SDx เรียง,คั่นด้วย ,>#<OR 0/1>"   t2: "<จำนวน SDx 0/1/2+>#<OR>"
 *   t3: "<OR>"                                   t4: รวมทุกเคสของ PDx
 */
export interface GroupingHistory {
  t1: Record<string, DrgCounts>;
  t2: Record<string, DrgCounts>;
  t3: Record<string, DrgCounts>;
  t4: DrgCounts;
  /** RW เฉลี่ยของ DRG (ใช้เมื่อไม่มีในตาราง TDRG) */
  drgRw: Record<string, number>;
}

/** รหัสที่ลงไว้ของแต่ละ AN (ใช้คำนวณผลตรวจกฎในหน้ารายชื่อ) */
export interface AdmissionCoding {
  diagnoses: Pick<Diagnosis, "icd10" | "diagtype" | "doctorCode">[];
  procedures: Pick<Procedure, "icd9">[];
}

/** แถวสำหรับรายงาน RW/CMI (RW จริงจาก an_stat) */
export interface RwRow {
  an: string;
  dischargeDate: string;
  wardCode: string | null;
  wardName: string | null;
  dischargeDoctor: CodeRef | null;
  drg: string | null;
  rw: number | null;
  adjrw: number | null;
  los: number | null;
}

export interface PatientSource {
  readonly kind: "demo" | "hosxp";
  listAdmissions(filter: AdmissionFilter): Promise<AdmissionRow[]>;
  getAdmission(an: string): Promise<AdmissionDetail | null>;
  filterOptions(): Promise<FilterOptions>;
  groupingHistory(pdx: string, from: string, to: string): Promise<GroupingHistory>;
  /** รหัสที่ลงไว้ของหลาย AN พร้อมกัน (สำหรับจุดสถานะในรายชื่อ) */
  codingOf(ans: string[]): Promise<Record<string, AdmissionCoding>>;
  rwRows(from: string, to: string): Promise<RwRow[]>;
}
