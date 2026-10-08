// lib/demo/data.ts
// ข้อมูลสมมติ 22 ราย จาก "สนามลอง AI ให้รหัส" (โปรแกรมเดิม) — ไม่ใช่ข้อมูลผู้ป่วยจริง
// วันที่ใน patients.json เก็บเป็น "จำนวนวันย้อนจากวันล่าสุด" แล้วแปลงเทียบกับวันนี้ ให้ตัวกรองช่วงด่วนมีข้อมูลเสมอ
// ผลจัดกลุ่มย้อนหลัง (history.json) และตาราง DRG เป็นค่าสมมติ ใช้เฉพาะโหมด demo

import history from "@/data/tdrg/demo/history.json";
import { addDays, todayIso } from "@/lib/date";
import type {
  AdmissionDetail,
  CodeRef,
  DiagType,
  DrgCounts,
  GroupingHistory,
} from "@/lib/patients/types";
import raw from "./patients.json";

interface RawPatient {
  an: string;
  hn: string;
  name: string;
  sex: "M" | "F";
  age: number;
  wardCode: string;
  ward: string;
  admitDoctor: string;
  dischargeDoctor: string | null;
  pdxDoctor: string | null;
  regAgo: number;
  dchAgo: number | null;
  los: number;
  admitted: boolean;
  dchstts: string | null;
  dchtype: string | null;
  pttype: string;
  drg: string | null;
  adjrw: number | null;
  rw: number | null;
  screen: {
    cc: string; hpi: string; pmh: string; bps: number; bpd: number; pulse: number;
    temperature: number; rr: number; bw: number; height: number | null;
  };
  prediag: string | null;
  admitDx: string[];
  diags: { code: string; type: string; name: string }[];
  procs: { code: string; name: string; or: "OR" | "NonOR"; day: number | null }[];
  labs: { day: number; name: string; value: string; unit: string | null; normal: string }[];
  meds: { name: string; strength: string | null; units: string; qty: number; day: number; lastDay: number }[];
  legacy: {
    hints: unknown[];
    alerts: [string, string][];
    level: string;
  };
}

export const DEMO_PATIENTS = (raw as unknown as { patients: RawPatient[] }).patients;

export const DEMO_DOCTORS: CodeRef[] = [
  { code: "D001", name: "นพ.สมมติ ใจดี" },
  { code: "D002", name: "พญ.ทดลอง รักษาดี" },
  { code: "D003", name: "นพ.ตัวอย่าง ผ่าตัดเก่ง" },
  { code: "D004", name: "พญ.จำลอง ทำคลอด" },
];

export const DEMO_WARDS: CodeRef[] = [
  ...new Map(DEMO_PATIENTS.map((p) => [p.wardCode, { code: p.wardCode, name: p.ward }])).values(),
];

function doctor(code: string | null): CodeRef | null {
  return code ? (DEMO_DOCTORS.find((d) => d.code === code) ?? null) : null;
}

/** วันล่าสุดของข้อมูล demo = เมื่อวาน (ทุกรายจำหน่ายแล้วหรือยังนอนอยู่ ณ วันนี้) */
function anchor(today: string): string {
  return addDays(today, -1);
}

export function buildDemoAdmissions(today: string = todayIso()): AdmissionDetail[] {
  const base = anchor(today);
  return DEMO_PATIENTS.map((p) => {
    const admitDate = addDays(base, -p.regAgo);
    const dischargeDate = p.dchAgo == null ? null : addDays(base, -p.dchAgo);
    const day = (d: number | null) => (d == null ? null : addDays(admitDate, d - 1));
    const pdx = p.diags.find((d) => d.type === "1");
    return {
      an: p.an,
      hn: p.hn,
      patientName: p.name,
      sex: p.sex,
      ageYears: p.age,
      admitDate,
      admitTime: null,
      dischargeDate,
      dischargeTime: null,
      wardCode: p.wardCode,
      wardName: p.ward,
      admitDoctor: doctor(p.admitDoctor),
      dischargeDoctor: doctor(p.dischargeDoctor),
      pdxDoctor: doctor(p.pdxDoctor),
      pdx: pdx?.code ?? null,
      los: p.los,
      dischargeType: p.dchtype ? { code: p.dchtype, name: p.dchtype } : null,
      drg: p.drg,
      rw: p.rw,
      adjrw: p.adjrw,
      cid: null,
      birthday: null,
      address: null,
      phone: null,
      pttypeName: p.pttype,
      dischargeStatus: p.dchstts ? { code: p.dchstts, name: p.dchstts } : null,
      diagnoses: p.diags.map((d) => ({
        icd10: d.code,
        diagtype: d.type as DiagType,
        name: d.name,
        doctorCode: d.type === "1" ? p.pdxDoctor : p.pdxDoctor ?? p.admitDoctor,
        doctorName: null,
      })),
      procedures: p.procs.map((x) => ({
        icd9: x.code,
        name: x.name,
        opDate: day(x.day),
        doctorCode: null,
        doctorName: null,
        orType: x.or,
      })),
      labs: p.labs.map((l, i) => ({
        date: day(l.day),
        code: `${l.name}#${i}`,
        name: l.name,
        value: l.value,
        unit: l.unit,
        normal: l.normal,
      })),
      drugs: p.meds.map((m) => ({
        date: day(m.day),
        lastDate: day(m.lastDay),
        code: m.name,
        name: m.name,
        strength: m.strength,
        units: m.units,
        qty: m.qty,
      })),
      screen: { ...p.screen },
      prediag: p.prediag,
      admitDx: p.admitDx,
    };
  });
}

type HistoryFile = {
  t1: Record<string, DrgCounts>;
  t2: Record<string, DrgCounts>;
  t3: Record<string, DrgCounts>;
  t4: Record<string, DrgCounts>;
  drg_rw: Record<string, number>;
};

/** ผลจัดกลุ่มย้อนหลังสมมติของ PDx (รหัสไม่มีจุด) */
export function demoGroupingHistory(pdx: string): GroupingHistory {
  const h = history as HistoryFile;
  const key = pdx.replace(/\./g, "").toUpperCase();
  const pick = (t: Record<string, DrgCounts>) =>
    Object.fromEntries(
      Object.entries(t)
        .filter(([k]) => k.split("#")[0] === key)
        .map(([k, v]) => [k.split("#").slice(1).join("#"), v]),
    );
  return { t1: pick(h.t1), t2: pick(h.t2), t3: pick(h.t3), t4: h.t4[key] ?? {}, drgRw: h.drg_rw };
}
