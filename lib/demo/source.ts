// lib/demo/source.ts
// แหล่งข้อมูลโหมด demo — กรองข้อมูลสมมติในหน่วยความจำ ด้วยเงื่อนไขเดียวกับ SQL ของ HOSxP

import { todayIso } from "@/lib/date";
import type {
  AdmissionDetail,
  AdmissionFilter,
  AdmissionRow,
  PatientSource,
  RwRow,
} from "@/lib/patients/types";
import { buildDemoAdmissions, demoGroupingHistory, DEMO_DOCTORS, DEMO_WARDS } from "./data";

function inRange(d: string | null, from?: string, to?: string): boolean {
  if (!from && !to) return true;
  if (!d) return false;
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

export function matchesFilter(a: AdmissionDetail, f: AdmissionFilter): boolean {
  if (!inRange(a.admitDate, f.admitFrom, f.admitTo)) return false;
  if (!inRange(a.dischargeDate, f.dischargeFrom, f.dischargeTo)) return false;
  if (f.ward && a.wardCode !== f.ward) return false;
  if (f.admitDoctor && a.admitDoctor?.code !== f.admitDoctor) return false;
  if (f.dischargeDoctor && a.dischargeDoctor?.code !== f.dischargeDoctor) return false;
  if (f.pdxDoctor && a.pdxDoctor?.code !== f.pdxDoctor) return false;
  if (f.q) {
    const q = f.q.trim();
    if (a.an !== q && a.hn !== q) return false;
  }
  if (f.pending) {
    const noPdx = !a.diagnoses.some((d) => d.diagtype === "1");
    const admitted = a.dischargeDate == null;
    const status = f.pendingStatus ?? "all";
    if (status === "noPdx" && !noPdx) return false;
    if (status === "admitted" && !admitted) return false;
    if (status === "all" && !(noPdx || admitted)) return false;
  }
  return true;
}

function toRow(a: AdmissionDetail): AdmissionRow {
  return {
    an: a.an,
    hn: a.hn,
    patientName: a.patientName,
    sex: a.sex,
    ageYears: a.ageYears,
    admitDate: a.admitDate,
    admitTime: a.admitTime,
    dischargeDate: a.dischargeDate,
    dischargeTime: a.dischargeTime,
    wardCode: a.wardCode,
    wardName: a.wardName,
    admitDoctor: a.admitDoctor,
    dischargeDoctor: a.dischargeDoctor,
    pdxDoctor: a.pdxDoctor,
    pdx: a.pdx,
    los: a.los,
    dischargeType: a.dischargeType,
    drg: a.drg,
    rw: a.rw,
    adjrw: a.adjrw,
  };
}

export const demoSource: PatientSource = {
  kind: "demo",

  async listAdmissions(filter) {
    return buildDemoAdmissions(todayIso())
      .filter((a) => matchesFilter(a, filter))
      .sort((x, y) => (x.admitDate < y.admitDate ? 1 : x.admitDate > y.admitDate ? -1 : 0))
      .map(toRow);
  },

  async getAdmission(an) {
    return buildDemoAdmissions(todayIso()).find((a) => a.an === an) ?? null;
  },

  async filterOptions() {
    return { wards: DEMO_WARDS, doctors: DEMO_DOCTORS };
  },

  async groupingHistory(pdx) {
    return demoGroupingHistory(pdx);
  },

  async codingOf(ans) {
    const set = new Set(ans);
    return Object.fromEntries(
      buildDemoAdmissions(todayIso())
        .filter((a) => set.has(a.an))
        .map((a) => [a.an, { diagnoses: a.diagnoses, procedures: a.procedures }]),
    );
  },

  async rwRows(from, to) {
    return buildDemoAdmissions(todayIso())
      .filter((a) => a.dischargeDate && a.dischargeDate >= from && a.dischargeDate <= to)
      .map<RwRow>((a) => ({
        an: a.an,
        dischargeDate: a.dischargeDate!,
        wardCode: a.wardCode,
        wardName: a.wardName,
        dischargeDoctor: a.dischargeDoctor,
        drg: a.drg,
        rw: a.rw,
        adjrw: a.adjrw,
        los: a.los,
      }));
  },
};
