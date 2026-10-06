// กฎข้อ 2: ใส่ข้อมูลสมมติที่มีตัวระบุตัวตนทุกแบบ แล้วยืนยันว่า payload ที่จะส่ง AI ไม่มีหลงเหลือ
import { describe, expect, it } from "vitest";
import type { AdmissionDetail } from "@/lib/patients/types";
import { buildDemoAdmissions } from "@/lib/demo/data";
import { assertNoIdentifiers, buildAiPayload, DeidentificationError, deidentify } from "./deidentify";

const FAKE: AdmissionDetail = {
  an: "690012345",
  hn: "000998877",
  patientName: "นายสมมติ ทดสอบระบบ",
  sex: "M",
  ageYears: 93,
  admitDate: "2026-09-01",
  admitTime: "08:15:00",
  dischargeDate: "2026-09-06",
  dischargeTime: "11:00:00",
  wardCode: "W01",
  wardName: "อายุรกรรมชาย",
  admitDoctor: { code: "D9", name: "นพ.ทดสอบ แพทย์รับ" },
  dischargeDoctor: { code: "D8", name: "พญ.ทดสอบ แพทย์จำหน่าย" },
  pdxDoctor: { code: "D7", name: "Dr. Fakename Doctor" },
  pdx: "J18.9",
  los: 5,
  drg: "DEMO02",
  rw: 1.2,
  adjrw: 1.25,
  cid: "9999912345678",
  birthday: "1933-02-14",
  address: "99/1 หมู่ 4 ต.สมมติ อ.ทดสอบ จ.ตัวอย่าง",
  phone: "081-234-5678",
  pttypeName: "บัตรทอง",
  dischargeStatus: { code: "2", name: "Improved" },
  dischargeType: { code: "1", name: "With approval" },
  diagnoses: [
    { icd10: "J18.9", diagtype: "1", name: "Pneumonia", doctorCode: "D7", doctorName: "Dr. Fakename Doctor" },
    { icd10: "I10", diagtype: "2", name: "Hypertension", doctorCode: "D7", doctorName: "Dr. Fakename Doctor" },
  ],
  procedures: [{ icd9: "96.04", name: "ETT", opDate: "2026-09-02", doctorCode: "D9", doctorName: "นพ.ทดสอบ แพทย์รับ" }],
  labs: [
    { date: "2026-09-01", code: "K", name: "Potassium", value: "2.9", unit: "mmol/L", normal: "3.5-5.1" },
    { date: "2026-09-01", code: "HC", name: "Hemoculture", value: "พบเชื้อ ผู้ป่วยนายสมมติ", unit: null, normal: null },
    { date: "2026-09-02", code: "X", name: "Note", value: "HN 000998877 call 0812345678", unit: null, normal: null },
    { date: "2026-09-02", code: "Y", name: "Sodium", value: "9999912345678", unit: "mmol/L", normal: null },
    { date: "2026-09-02", code: "Z", name: "ผลตรวจพิเศษ", value: "12", unit: null, normal: null },
  ],
  drugs: [
    { date: "2026-09-01", code: "CEF", name: "Ceftriaxone inj", strength: "1 g", units: "vial", qty: 2 },
    { date: "2026-09-03", code: "TH", name: "ยาสมุนไพร นายสมมติ", strength: null, units: null, qty: 1 },
  ],
};

describe("deidentify", () => {
  const payload = deidentify(FAKE);
  const json = JSON.stringify(payload);

  it("ไม่มีตัวระบุตัวตนใดๆ ใน payload", () => {
    const identifiers = [
      FAKE.an, FAKE.hn, FAKE.cid!, "12345678", FAKE.phone!, "0812345678", "081-234-5678",
      "นายสมมติ", "ทดสอบระบบ", FAKE.address!, "ต.สมมติ", FAKE.birthday!,
      "2026-09-01", "2026-09-02", "2026-09-06", "1933",
      "แพทย์รับ", "แพทย์จำหน่าย", "Fakename", "D7", "D8", "D9",
      "อายุรกรรม", "บัตรทอง",
    ];
    for (const s of identifiers) expect(json, `พบ "${s}"`).not.toContain(s);
    expect(json).not.toMatch(/[฀-๿]/);
    expect(json).not.toMatch(/\d{7,}/);
  });

  it("อายุ ≥ 90 เป็น 90+", () => {
    expect(payload.age).toBe("90+");
    expect(deidentify({ ...FAKE, ageYears: 89 }).age).toBe("89");
    expect(deidentify({ ...FAKE, ageYears: null }).age).toBe("unknown");
  });

  it("วันที่เป็นวันนับจาก admit", () => {
    expect(payload.procedures).toEqual([{ id: "P1", code: "96.04", day: 1 }]);
    expect(payload.labs[0]).toMatchObject({ test: "Potassium", value: "2.9", day: 0 });
    expect(payload.drugs[0]).toMatchObject({ name: "Ceftriaxone inj 1 g", day: 0 });
  });

  it("ตัดผล lab ที่เป็นข้อความอิสระ/ตัวเลขยาว และชื่อภาษาไทยทิ้ง", () => {
    expect(payload.labs.map((l) => l.test)).toEqual(["Potassium"]);
    expect(payload.drugs.map((d) => d.name)).toEqual(["Ceftriaxone inj 1 g"]);
  });

  it("เก็บข้อมูลมีโครงสร้างที่จำเป็นไว้", () => {
    expect(payload).toMatchObject({ sex: "M", losDays: 5, stillAdmitted: false });
    expect(payload.existingDiagnoses.map((d) => d.code)).toEqual(["J18.9", "I10"]);
  });

  it("assertNoIdentifiers ผ่านกับ payload ที่ตัดแล้ว และ throw ถ้ามีอะไรหลุด", () => {
    expect(() => assertNoIdentifiers(json, FAKE)).not.toThrow();
    for (const leak of [
      { ...payload, note: FAKE.hn },
      { ...payload, note: "นายสมมติ" },
      { ...payload, note: "2026-09-01" },
      { ...payload, note: "1/9/2569" },
      { ...payload, note: "Fakename" },
      { ...payload, note: "081-234-5678" },
    ]) {
      expect(() => assertNoIdentifiers(JSON.stringify(leak), FAKE)).toThrow(DeidentificationError);
    }
  });

  it("ข้อมูลสมมติทุกรายในโหมด demo ผ่านการตรวจ", () => {
    for (const a of buildDemoAdmissions("2026-10-06")) {
      expect(() => buildAiPayload(a), a.an).not.toThrow();
    }
  });
});
