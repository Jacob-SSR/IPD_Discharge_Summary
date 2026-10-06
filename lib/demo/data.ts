// lib/demo/data.ts
// ข้อมูลสมมติล้วน สำหรับโหมด demo — ไม่ใช่ข้อมูลผู้ป่วยจริง
// ชื่อ/HN/AN/เลขบัตร/ที่อยู่/เบอร์โทร ถูกแต่งขึ้นทั้งหมด (ขึ้นต้นด้วยคำว่า "สมมติ"/"ทดสอบ"/9999)
// DRG ใช้รหัส "DEMOxx" และค่า RW เป็นตัวเลขสมมติ ไม่ใช่ค่าจากตาราง TDRG จริง
// วันที่คำนวณย้อนจาก "วันนี้" เพื่อให้ตัวกรองช่วงด่วนมีข้อมูลเสมอ

import { addDays, todayIso } from "@/lib/date";
import type {
  AdmissionDetail,
  CodeRef,
  DiagType,
  HistoricalGroup,
  Sex,
} from "@/lib/patients/types";

export const DEMO_WARDS: CodeRef[] = [
  { code: "W01", name: "อายุรกรรมชาย (สมมติ)" },
  { code: "W02", name: "อายุรกรรมหญิง (สมมติ)" },
  { code: "W03", name: "ศัลยกรรม (สมมติ)" },
  { code: "W04", name: "สูติกรรม (สมมติ)" },
  { code: "W05", name: "หอผู้ป่วยพิเศษ (สมมติ)" },
];

export const DEMO_DOCTORS: CodeRef[] = [
  { code: "D001", name: "นพ.สมมติ ใจดี" },
  { code: "D002", name: "พญ.ทดลอง รักษาดี" },
  { code: "D003", name: "นพ.ตัวอย่าง ผ่าตัดเก่ง" },
  { code: "D004", name: "พญ.จำลอง ทำคลอด" },
];

const DCHSTTS: Record<string, string> = {
  "1": "Complete recovery",
  "2": "Improved",
  "3": "Not improved",
  "4": "Normal delivery",
  "9": "Dead",
};
const DCHTYPE: Record<string, string> = {
  "1": "With approval",
  "2": "Against advice",
  "4": "By transfer",
  "8": "Dead",
};

interface LabDef { name: string; unit: string | null; normal: string | null }
const LAB: Record<string, LabDef> = {
  HB: { name: "Hemoglobin", unit: "g/dL", normal: "12-16" },
  HCT: { name: "Hematocrit", unit: "%", normal: "36-48" },
  WBC: { name: "WBC", unit: "x10^3/uL", normal: "4.5-11" },
  PLT: { name: "Platelet", unit: "x10^3/uL", normal: "150-450" },
  NA: { name: "Sodium", unit: "mmol/L", normal: "135-145" },
  K: { name: "Potassium", unit: "mmol/L", normal: "3.5-5.1" },
  CR: { name: "Creatinine", unit: "mg/dL", normal: "0.6-1.2" },
  BUN: { name: "BUN", unit: "mg/dL", normal: "7-20" },
  GLU: { name: "Glucose (DTX)", unit: "mg/dL", normal: "70-140" },
  HBA1C: { name: "HbA1c", unit: "%", normal: "<6.5" },
  LACT: { name: "Lactate", unit: "mmol/L", normal: "0.5-2.2" },
  UAWBC: { name: "UA: WBC", unit: "/HPF", normal: "0-5" },
  HC: { name: "Hemoculture", unit: null, normal: null },
  LDL: { name: "LDL-C", unit: "mg/dL", normal: "<130" },
};

interface DrugDef { name: string; strength: string | null; units: string | null }
const DRUG: Record<string, DrugDef> = {
  CEF: { name: "Ceftriaxone inj", strength: "1 g", units: "vial" },
  KCL: { name: "Potassium chloride elixir", strength: "20 mEq/15 mL", units: "bottle" },
  NSS: { name: "0.9% NaCl", strength: "1000 mL", units: "bag" },
  PARA: { name: "Paracetamol", strength: "500 mg", units: "tab" },
  RI: { name: "Insulin regular (RI)", strength: "100 IU/mL", units: "vial" },
  FURO: { name: "Furosemide inj", strength: "20 mg/2 mL", units: "amp" },
  WAR: { name: "Warfarin", strength: "3 mg", units: "tab" },
  OMP: { name: "Omeprazole inj", strength: "40 mg", units: "vial" },
  PRC: { name: "Packed red cells (LPRC)", strength: null, units: "unit" },
  SALB: { name: "Salbutamol nebule", strength: "2.5 mg", units: "neb" },
  DEXA: { name: "Dexamethasone inj", strength: "4 mg", units: "amp" },
  CLOX: { name: "Cloxacillin inj", strength: "1 g", units: "vial" },
  ASA: { name: "Aspirin", strength: "81 mg", units: "tab" },
  ATOR: { name: "Atorvastatin", strength: "40 mg", units: "tab" },
  KAL: { name: "Calcium polystyrene sulfonate", strength: "5 g", units: "sachet" },
  PGS: { name: "Penicillin G sodium inj", strength: "5 MU", units: "vial" },
  OXY: { name: "Oxytocin inj", strength: "10 IU", units: "amp" },
  CEFA: { name: "Cefazolin inj", strength: "1 g", units: "vial" },
  MORPH: { name: "Morphine inj", strength: "10 mg", units: "amp" },
};

const ICD10_NAME: Record<string, string> = {
  "J18.9": "Pneumonia, unspecified",
  "A09": "Diarrhoea and gastroenteritis of presumed infectious origin",
  "E86": "Volume depletion",
  "E11.9": "Type 2 diabetes mellitus without complications",
  "N39.0": "Urinary tract infection, site not specified",
  "I50.0": "Congestive heart failure",
  "I50.9": "Heart failure, unspecified",
  "I48": "Atrial fibrillation and flutter",
  "A41.9": "Sepsis, unspecified",
  "A91": "Dengue haemorrhagic fever",
  "J44.1": "Chronic obstructive pulmonary disease with acute exacerbation, unspecified",
  "I63.9": "Cerebral infarction, unspecified",
  "I10": "Essential (primary) hypertension",
  "S06.0": "Concussion",
  "L03.1": "Cellulitis of other parts of limb",
  "O80.0": "Spontaneous vertex delivery",
  "Z37.0": "Single live birth",
  "K35.8": "Acute appendicitis, other and unspecified",
  "K92.2": "Gastrointestinal haemorrhage, unspecified",
  "D62": "Acute posthaemorrhagic anaemia",
  "N18.5": "Chronic kidney disease, stage 5",
  "E87.5": "Hyperkalaemia",
  "J45.9": "Asthma, unspecified",
  "A27.9": "Leptospirosis, unspecified",
  "I69.4": "Sequelae of stroke, not specified as haemorrhage or infarction",
  "R50.9": "Fever, unspecified",
  "G63.2": "Diabetic polyneuropathy",
  "E11.4": "Type 2 diabetes mellitus with neurological complications",
  "S72.0": "Fracture of neck of femur",
  "W19": "Unspecified fall",
  "S52.5": "Fracture of lower end of radius",
};

const ICD9_NAME: Record<string, string> = {
  "73.59": "Other manually assisted delivery",
  "75.69": "Repair of other current obstetric laceration",
  "47.09": "Other appendectomy",
  "99.04": "Transfusion of packed cells",
  "39.95": "Hemodialysis",
  "79.35": "Open reduction of fracture with internal fixation, femur",
  "79.02": "Closed reduction of fracture without internal fixation, radius and ulna",
};

interface CaseDef {
  n: number; // ลำดับ (ใช้สร้าง AN/HN/ชื่อ)
  sex: Sex;
  age: number;
  ward: string;
  admDr: string;
  dchDr: string | null;
  admitAgo: number;
  los: number | null; // null = ยังนอนอยู่
  dchstts?: string;
  dchtype?: string;
  dx: [string, DiagType, string][]; // [icd10, diagtype, doctor]
  ops?: [string, number, string][]; // [icd9, day from admit, doctor]
  labs?: [string, number, string][]; // [lab, day, value]
  drugs?: [string, number, number][]; // [drug, day, qty]
  drg?: string;
  rw?: number;
  adjrw?: number;
}

const FIRST_NAMES_M = ["สมมติ", "ทดสอบ", "ตัวอย่าง", "จำลอง", "สาธิต"];
const FIRST_NAMES_F = ["สมมติหญิง", "ทดสอบหญิง", "ตัวอย่างหญิง", "จำลองหญิง", "สาธิตหญิง"];

const CASES: CaseDef[] = [
  { n: 1, sex: "M", age: 67, ward: "W01", admDr: "D001", dchDr: "D001", admitAgo: 9, los: 5, dchstts: "2", dchtype: "1",
    dx: [["J18.9", "1", "D001"]],
    labs: [["WBC", 0, "15.2"], ["K", 1, "2.9"], ["NA", 1, "138"], ["K", 3, "3.6"], ["CR", 0, "1.0"]],
    drugs: [["CEF", 0, 2], ["CEF", 1, 2], ["CEF", 2, 2], ["KCL", 1, 1], ["PARA", 0, 10]],
    drg: "DEMO01", rw: 0.8, adjrw: 0.8 },
  { n: 2, sex: "F", age: 34, ward: "W02", admDr: "D002", dchDr: "D002", admitAgo: 6, los: 2, dchstts: "1", dchtype: "1",
    dx: [["A09", "1", "D002"], ["E86", "2", "D002"]],
    labs: [["K", 0, "3.2"], ["NA", 0, "136"], ["BUN", 0, "28"], ["CR", 0, "1.1"]],
    drugs: [["NSS", 0, 3], ["NSS", 1, 2], ["KCL", 0, 1]],
    drg: "DEMO04", rw: 0.65, adjrw: 0.65 },
  { n: 3, sex: "F", age: 58, ward: "W02", admDr: "D002", dchDr: "D002", admitAgo: 12, los: 4, dchstts: "2", dchtype: "1",
    dx: [["E11.9", "1", "D002"], ["N39.0", "2", "D002"]],
    labs: [["GLU", 0, "420"], ["GLU", 1, "260"], ["HBA1C", 0, "11.2"], ["UAWBC", 0, "50-100"], ["CR", 0, "1.0"]],
    drugs: [["RI", 0, 1], ["CEF", 0, 1], ["CEF", 1, 1], ["CEF", 2, 1]],
    drg: "DEMO06", rw: 0.9, adjrw: 0.9 },
  { n: 4, sex: "M", age: 74, ward: "W01", admDr: "D001", dchDr: "D001", admitAgo: 20, los: 6, dchstts: "2", dchtype: "1",
    dx: [["I50.0", "1", "D001"], ["I48", "2", "D001"]],
    labs: [["NA", 0, "131"], ["NA", 2, "133"], ["K", 0, "4.1"], ["CR", 0, "1.4"]],
    drugs: [["FURO", 0, 3], ["FURO", 1, 3], ["WAR", 2, 7]],
    drg: "DEMO08", rw: 1.4, adjrw: 1.4 },
  { n: 5, sex: "F", age: 81, ward: "W02", admDr: "D002", dchDr: "D001", admitAgo: 15, los: 7, dchstts: "2", dchtype: "1",
    dx: [["A41.9", "1", "D001"], ["N39.0", "2", "D001"]],
    labs: [["LACT", 0, "4.2"], ["HC", 0, "E. coli"], ["PLT", 1, "85"], ["WBC", 0, "21.4"], ["CR", 0, "1.6"]],
    drugs: [["CEF", 0, 2], ["CEF", 1, 2], ["CEF", 2, 2], ["NSS", 0, 4]],
    drg: "DEMO10", rw: 2.1, adjrw: 2.1 },
  { n: 6, sex: "M", age: 19, ward: "W01", admDr: "D001", dchDr: "D001", admitAgo: 4, los: 3, dchstts: "1", dchtype: "1",
    dx: [["A91", "1", "D001"]],
    labs: [["PLT", 0, "62"], ["PLT", 1, "32"], ["HCT", 1, "48"], ["WBC", 0, "2.8"]],
    drugs: [["NSS", 0, 2], ["NSS", 1, 3], ["PARA", 0, 10]],
    drg: "DEMO12", rw: 0.7, adjrw: 0.7 },
  { n: 7, sex: "M", age: 71, ward: "W01", admDr: "D001", dchDr: "D002", admitAgo: 25, los: 4, dchstts: "2", dchtype: "1",
    dx: [["J44.1", "1", "D002"]],
    labs: [["K", 0, "3.3"], ["WBC", 0, "11.8"]],
    drugs: [["SALB", 0, 6], ["SALB", 1, 6], ["DEXA", 0, 3], ["DEXA", 1, 3]],
    drg: "DEMO14", rw: 0.85, adjrw: 0.85 },
  { n: 8, sex: "F", age: 66, ward: "W02", admDr: "D002", dchDr: "D002", admitAgo: 30, los: 5, dchstts: "2", dchtype: "1",
    dx: [["I63.9", "1", "D002"], ["I10", "2", "D002"]],
    labs: [["LDL", 1, "190"], ["GLU", 0, "118"]],
    drugs: [["ASA", 0, 30], ["ATOR", 0, 30]],
    drg: "DEMO16", rw: 1.3, adjrw: 1.3 },
  { n: 9, sex: "M", age: 27, ward: "W03", admDr: "D003", dchDr: "D003", admitAgo: 3, los: 1, dchstts: "1", dchtype: "1",
    dx: [["S06.0", "1", "D003"]],
    labs: [["HB", 0, "14.1"]],
    drugs: [["PARA", 0, 10]],
    drg: "DEMO18", rw: 0.4, adjrw: 0.4 },
  { n: 10, sex: "F", age: 49, ward: "W02", admDr: "D002", dchDr: "D002", admitAgo: 8, los: 4, dchstts: "2", dchtype: "1",
    dx: [["L03.1", "1", "D002"]],
    labs: [["WBC", 0, "13.0"], ["GLU", 0, "105"]],
    drugs: [["CLOX", 0, 4], ["CLOX", 1, 4], ["CLOX", 2, 4]],
    drg: "DEMO20", rw: 0.6, adjrw: 0.6 },
  { n: 11, sex: "F", age: 26, ward: "W04", admDr: "D004", dchDr: "D004", admitAgo: 5, los: 2, dchstts: "4", dchtype: "1",
    dx: [["O80.0", "1", "D004"], ["Z37.0", "4", "D004"]],
    ops: [["73.59", 0, "D004"], ["75.69", 0, "D004"]],
    labs: [["HB", 0, "11.6"]],
    drugs: [["OXY", 0, 2]],
    drg: "DEMO22", rw: 0.3, adjrw: 0.3 },
  { n: 12, sex: "M", age: 22, ward: "W03", admDr: "D003", dchDr: "D003", admitAgo: 10, los: 3, dchstts: "1", dchtype: "1",
    dx: [["K35.8", "1", "D003"]],
    ops: [["47.09", 0, "D003"]],
    labs: [["WBC", 0, "16.5"]],
    drugs: [["CEFA", 0, 1], ["MORPH", 0, 2]],
    drg: "DEMO24", rw: 1.1, adjrw: 1.1 },
  { n: 13, sex: "M", age: 63, ward: "W01", admDr: "D001", dchDr: "D001", admitAgo: 14, los: 4, dchstts: "2", dchtype: "1",
    dx: [["K92.2", "1", "D001"], ["D62", "2", "D001"]],
    ops: [["99.04", 0, "D001"]],
    labs: [["HB", 0, "6.8"], ["HB", 1, "8.9"], ["BUN", 0, "45"]],
    drugs: [["OMP", 0, 2], ["OMP", 1, 2], ["PRC", 0, 2]],
    drg: "DEMO26", rw: 0.95, adjrw: 0.95 },
  { n: 14, sex: "F", age: 55, ward: "W02", admDr: "D002", dchDr: "D002", admitAgo: 18, los: 3, dchstts: "2", dchtype: "1",
    dx: [["N18.5", "1", "D002"], ["E87.5", "2", "D002"]],
    ops: [["39.95", 0, "D002"]],
    labs: [["K", 0, "6.8"], ["K", 1, "5.0"], ["CR", 0, "9.8"], ["HB", 0, "8.1"]],
    drugs: [["KAL", 0, 3]],
    drg: "DEMO28", rw: 1.25, adjrw: 1.25 },
  { n: 15, sex: "F", age: 12, ward: "W05", admDr: "D001", dchDr: "D001", admitAgo: 2, los: 1, dchstts: "1", dchtype: "1",
    dx: [["J45.9", "1", "D001"]],
    drugs: [["SALB", 0, 6], ["DEXA", 0, 2]],
    drg: "DEMO30", rw: 0.45, adjrw: 0.45 },
  { n: 16, sex: "M", age: 45, ward: "W01", admDr: "D001", dchDr: "D001", admitAgo: 22, los: 5, dchstts: "2", dchtype: "1",
    dx: [["A27.9", "1", "D001"]],
    labs: [["CR", 0, "3.1"], ["CR", 3, "1.4"], ["PLT", 0, "120"]],
    drugs: [["PGS", 0, 4], ["PGS", 1, 4], ["PGS", 2, 4]],
    drg: "DEMO32", rw: 0.9, adjrw: 0.9 },
  { n: 17, sex: "F", age: 77, ward: "W02", admDr: "D002", dchDr: "D002", admitAgo: 40, los: 6, dchstts: "3", dchtype: "1",
    dx: [["I69.4", "1", "D002"], ["I10", "2", "D002"]],
    drugs: [["ASA", 0, 30]],
    drg: "DEMO34", rw: 0.75, adjrw: 0.75 },
  { n: 18, sex: "M", age: 8, ward: "W05", admDr: "D001", dchDr: "D001", admitAgo: 11, los: 3, dchstts: "1", dchtype: "1",
    dx: [["R50.9", "1", "D001"], ["N39.0", "2", "D001"]],
    labs: [["UAWBC", 0, "30-50"], ["WBC", 0, "14.0"]],
    drugs: [["CEF", 0, 1], ["CEF", 1, 1], ["PARA", 0, 10]],
    drg: "DEMO36", rw: 0.4, adjrw: 0.4 },
  { n: 19, sex: "F", age: 62, ward: "W02", admDr: "D002", dchDr: "D002", admitAgo: 35, los: 4, dchstts: "2", dchtype: "1",
    dx: [["G63.2", "1", "D002"], ["E11.4", "2", "D002"]],
    labs: [["GLU", 0, "210"], ["HBA1C", 0, "9.4"]],
    drugs: [["RI", 0, 1]],
    drg: "DEMO38", rw: 0.7, adjrw: 0.7 },
  { n: 20, sex: "F", age: 92, ward: "W03", admDr: "D003", dchDr: "D003", admitAgo: 16, los: 7, dchstts: "2", dchtype: "1",
    dx: [["S72.0", "1", "D003"], ["W19", "5", "D003"]],
    ops: [["79.35", 1, "D003"]],
    labs: [["HB", 0, "11.0"], ["HB", 2, "9.2"]],
    drugs: [["CEFA", 1, 3], ["MORPH", 1, 4]],
    drg: "DEMO40", rw: 2.6, adjrw: 2.6 },
  { n: 21, sex: "M", age: 70, ward: "W01", admDr: "D001", dchDr: null, admitAgo: 2, los: null,
    dx: [],
    labs: [["WBC", 0, "17.1"], ["K", 0, "3.1"]],
    drugs: [["CEF", 0, 2], ["CEF", 1, 2]] },
  { n: 22, sex: "F", age: 40, ward: "W02", admDr: "D002", dchDr: "D002", admitAgo: 3, los: 2, dchstts: "1", dchtype: "1",
    dx: [],
    labs: [["K", 0, "3.4"]],
    drugs: [["NSS", 0, 3]] },
  { n: 23, sex: "M", age: 80, ward: "W01", admDr: "D001", dchDr: null, admitAgo: 1, los: null,
    dx: [["I50.0", "1", "D001"]],
    labs: [["NA", 0, "129"]],
    drugs: [["FURO", 0, 3]] },
  { n: 24, sex: "M", age: 69, ward: "W01", admDr: "D001", dchDr: "D001", admitAgo: 28, los: 5, dchstts: "2", dchtype: "1",
    dx: [["I50.9", "1", "D001"], ["I50.0", "2", "D001"]],
    labs: [["NA", 0, "137"]],
    drugs: [["FURO", 0, 3]],
    drg: "DEMO08", rw: 1.4, adjrw: 1.4 },
  { n: 25, sex: "F", age: 72, ward: "W02", admDr: "D002", dchDr: "D002", admitAgo: 45, los: 4, dchstts: "2", dchtype: "1",
    dx: [["I10", "1", "D002"], ["J18.9", "2", "D002"]],
    labs: [["WBC", 0, "14.8"]],
    drugs: [["CEF", 0, 2], ["CEF", 1, 2]],
    drg: "DEMO42", rw: 0.5, adjrw: 0.5 },
  { n: 26, sex: "M", age: 38, ward: "W03", admDr: "D003", dchDr: "D003", admitAgo: 50, los: 2, dchstts: "1", dchtype: "1",
    dx: [["W19", "1", "D003"], ["S52.5", "2", "D003"]],
    ops: [["79.02", 0, "D003"]],
    drugs: [["PARA", 0, 10]],
    drg: "DEMO44", rw: 0.55, adjrw: 0.55 },
];

function doctor(code: string | null): CodeRef | null {
  if (!code) return null;
  return DEMO_DOCTORS.find((d) => d.code === code) ?? null;
}

function pad(n: number, len: number): string {
  return String(n).padStart(len, "0");
}

/** สร้างข้อมูล demo ทั้งหมดโดยอิงวันที่ today (เรียกซ้ำได้ ผลเหมือนเดิมในวันเดียวกัน) */
export function buildDemoAdmissions(today: string = todayIso()): AdmissionDetail[] {
  return CASES.map((c) => {
    const admitDate = addDays(today, -c.admitAgo);
    const dischargeDate = c.los == null ? null : addDays(admitDate, c.los);
    const ward = DEMO_WARDS.find((w) => w.code === c.ward) ?? null;
    const firstNames = c.sex === "M" ? FIRST_NAMES_M : FIRST_NAMES_F;
    const fname = firstNames[c.n % firstNames.length];
    const pname = c.age < 15 ? (c.sex === "M" ? "ด.ช." : "ด.ญ.") : c.sex === "M" ? "นาย" : "นาง";
    const pdxRow = c.dx.find((d) => d[1] === "1");
    const birthYear = Number(today.slice(0, 4)) - c.age;

    return {
      an: `6900${pad(c.n, 5)}`,
      hn: `99${pad(c.n, 7)}`,
      patientName: `${pname}${fname} ผู้ป่วยทดสอบ${pad(c.n, 2)}`,
      sex: c.sex,
      ageYears: c.age,
      admitDate,
      admitTime: `${pad(8 + (c.n % 10), 2)}:${pad((c.n * 7) % 60, 2)}:00`,
      dischargeDate,
      dischargeTime: dischargeDate ? `${pad(10 + (c.n % 6), 2)}:00:00` : null,
      wardCode: ward?.code ?? null,
      wardName: ward?.name ?? null,
      admitDoctor: doctor(c.admDr),
      dischargeDoctor: doctor(c.dchDr),
      pdxDoctor: pdxRow ? doctor(pdxRow[2]) : null,
      pdx: pdxRow ? pdxRow[0] : null,
      los: c.los,
      drg: c.drg ?? null,
      rw: c.rw ?? null,
      adjrw: c.adjrw ?? null,
      cid: `99999${pad(c.n, 8)}`,
      birthday: `${birthYear}-0${1 + (c.n % 9)}-1${c.n % 9}`,
      address: `${c.n} หมู่ ${1 + (c.n % 9)} ต.สมมติ อ.ทดสอบ จ.ตัวอย่าง`,
      phone: `099000${pad(c.n, 4)}`,
      pttypeName: c.n % 3 === 0 ? "ข้าราชการ (สมมติ)" : "บัตรทอง UC (สมมติ)",
      dischargeStatus: c.dchstts ? { code: c.dchstts, name: DCHSTTS[c.dchstts] } : null,
      dischargeType: c.dchtype ? { code: c.dchtype, name: DCHTYPE[c.dchtype] } : null,
      diagnoses: c.dx.map(([icd10, diagtype, dr]) => ({
        icd10,
        diagtype,
        name: ICD10_NAME[icd10] ?? null,
        doctorCode: dr,
        doctorName: doctor(dr)?.name ?? null,
      })),
      procedures: (c.ops ?? []).map(([icd9, day, dr]) => ({
        icd9,
        name: ICD9_NAME[icd9] ?? null,
        opDate: addDays(admitDate, day),
        doctorCode: dr,
        doctorName: doctor(dr)?.name ?? null,
      })),
      labs: (c.labs ?? []).map(([code, day, value]) => ({
        date: addDays(admitDate, day),
        code,
        name: LAB[code].name,
        value,
        unit: LAB[code].unit,
        normal: LAB[code].normal,
      })),
      drugs: (c.drugs ?? []).map(([code, day, qty]) => ({
        date: addDays(admitDate, day),
        code,
        name: DRUG[code].name,
        strength: DRUG[code].strength,
        units: DRUG[code].units,
        qty,
      })),
    };
  });
}

/**
 * ผลจัดกลุ่มย้อนหลังสมมติ — ใช้ทดสอบตัวประมาณ RW ในโหมด demo
 * แต่ละ PDx มีกลุ่ม "ไม่มี CC" กับ "มี CC" (ตัดสินจากจำนวน SDx เฉลี่ย)
 */
export const DEMO_HISTORY: Record<string, HistoricalGroup[]> = {
  "J18.9": [
    { drg: "DEMO01", n: 120, avgRw: 0.8, avgAdjRw: 0.82, hasOr: false, avgSdx: 0 },
    { drg: "DEMO02", n: 85, avgRw: 1.2, avgAdjRw: 1.25, hasOr: false, avgSdx: 1.2 },
  ],
  "A09": [
    { drg: "DEMO03", n: 200, avgRw: 0.45, avgAdjRw: 0.45, hasOr: false, avgSdx: 0 },
    { drg: "DEMO04", n: 90, avgRw: 0.65, avgAdjRw: 0.66, hasOr: false, avgSdx: 1.5 },
  ],
  "E11.9": [
    { drg: "DEMO05", n: 60, avgRw: 0.6, avgAdjRw: 0.6, hasOr: false, avgSdx: 0 },
    { drg: "DEMO06", n: 40, avgRw: 0.9, avgAdjRw: 0.92, hasOr: false, avgSdx: 1.5 },
  ],
  "I50.0": [
    { drg: "DEMO07", n: 50, avgRw: 1.0, avgAdjRw: 1.0, hasOr: false, avgSdx: 0 },
    { drg: "DEMO08", n: 70, avgRw: 1.4, avgAdjRw: 1.45, hasOr: false, avgSdx: 2 },
  ],
  "A41.9": [
    { drg: "DEMO09", n: 30, avgRw: 1.5, avgAdjRw: 1.55, hasOr: false, avgSdx: 0.5 },
    { drg: "DEMO10", n: 45, avgRw: 2.1, avgAdjRw: 2.2, hasOr: false, avgSdx: 2.5 },
  ],
  "J44.1": [
    { drg: "DEMO13", n: 70, avgRw: 0.6, avgAdjRw: 0.6, hasOr: false, avgSdx: 0 },
    { drg: "DEMO14", n: 35, avgRw: 0.85, avgAdjRw: 0.88, hasOr: false, avgSdx: 1.5 },
  ],
  "K92.2": [
    { drg: "DEMO25", n: 25, avgRw: 0.7, avgAdjRw: 0.7, hasOr: false, avgSdx: 0 },
    { drg: "DEMO26", n: 30, avgRw: 0.95, avgAdjRw: 0.97, hasOr: false, avgSdx: 1.5 },
  ],
  "S72.0": [
    { drg: "DEMO39", n: 10, avgRw: 1.2, avgAdjRw: 1.2, hasOr: false, avgSdx: 1 },
    { drg: "DEMO40", n: 22, avgRw: 2.6, avgAdjRw: 2.7, hasOr: true, avgSdx: 1.5 },
  ],
};
