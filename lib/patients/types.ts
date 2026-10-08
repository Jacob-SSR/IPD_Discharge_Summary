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
  "1": "โรคหลัก",
  "2": "โรคร่วม",
  "3": "โรคแทรก",
  "4": "อื่นๆ",
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
  dischargeType: CodeRef | null;
  diagnoses: Diagnosis[];
  procedures: Procedure[];
  labs: LabResult[];
  drugs: DrugOrder[];
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

/** ผลจัดกลุ่ม DRG ย้อนหลังของ PDx เดียวกัน (ใช้ประมาณ RW) */
export interface HistoricalGroup {
  drg: string;
  n: number;
  avgRw: number | null;
  avgAdjRw: number | null;
  /** มีหัตถการ OR หรือไม่ (null = ไม่ทราบ) */
  hasOr: boolean | null;
  /** จำนวน SDx เฉลี่ยของกลุ่ม */
  avgSdx: number | null;
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
  historicalGroups(pdx: string, from: string, to: string): Promise<HistoricalGroup[]>;
  rwRows(from: string, to: string): Promise<RwRow[]>;
}
