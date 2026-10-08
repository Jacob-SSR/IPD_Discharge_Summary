// กฎข้อ 2: ใส่ข้อมูลสมมติที่มีตัวระบุตัวตนทุกแบบ (รวม free text) แล้วยืนยันว่าข้อความที่จะส่ง AI ไม่มีหลงเหลือ
import { describe, expect, it } from "vitest";
import { buildDemoAdmissions } from "@/lib/demo/data";
import type { AdmissionDetail } from "@/lib/patients/types";
import { assertNoIdentifiers, DeidentificationError, deidentify } from "./deidentify";
import { promptFor } from "./index";

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
  dischargeType: { code: "1", name: "With approval" },
  drg: "DEMO02",
  rw: 1.2,
  adjrw: 1.25,
  cid: "9999912345678",
  birthday: "1933-02-14",
  address: "99/1 หมู่ 4 ต.สมมติ อ.ทดสอบ จ.ตัวอย่าง",
  phone: "081-234-5678",
  pttypeName: "บัตรทอง",
  dischargeStatus: { code: "2", name: "Improved" },
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
    { date: "2026-09-02", code: "Z", name: "ผลตรวจพิเศษ นายสมมติ", value: "12", unit: null, normal: null },
  ],
  drugs: [
    { date: "2026-09-01", code: "CEF", name: "Ceftriaxone inj", strength: "1 g", units: "vial", qty: 2 },
    { date: "2026-09-02", code: "KCL", name: "Elixir KCl", strength: "15 ml", units: "dose", qty: 3 },
    { date: "2026-09-03", code: "TH", name: "ยาสมุนไพร นายสมมติ", strength: null, units: null, qty: 1 },
  ],
  screen: {
    cc: "ไข้ ไอ หอบ 3 วัน ญาตินายสมหญิงพามา",
    hpi: "ผู้ป่วยนายสมมติ โทร 0812345678 บ้านเลขที่ 99/1 มีไข้สูงหนาวสั่น",
    pmh: "HT 10 ปี รักษาที่ รพ.สต.บ้านสมมติ",
    bps: 150,
    bpd: 90,
    pulse: 110,
    temperature: 38.9,
    rr: 28,
    bw: 52,
    height: null,
  },
  prediag: "Pneumonia ส่งจาก นพ.ทดสอบ แพทย์รับ",
  admitDx: ["J18.9"],
};
const COURSE = "แพทย์ผู้รักษา นพ.ทดสอบ แพทย์รับ ให้ ceftriaxone แล้วอาการดีขึ้น นัด F/U 2 สัปดาห์";

describe("deidentify + prompt", () => {
  const { prompt, case: c } = promptFor(FAKE, undefined, COURSE);

  it("ไม่มีตัวระบุตัวตนใดๆ ในข้อความที่จะส่ง", () => {
    const identifiers = [
      FAKE.an, FAKE.hn, FAKE.cid!, "12345678", FAKE.phone!, "0812345678", "081-234-5678",
      "นายสมมติ", "สมมติ", "ทดสอบระบบ", FAKE.address!, "ต.สมมติ", "99/1", FAKE.birthday!,
      "2026-09-01", "2026-09-02", "2026-09-06", "1933",
      "แพทย์รับ", "แพทย์จำหน่าย", "Fakename", "D7", "D8", "D9",
      "อายุรกรรม", "บัตรทอง", "สมหญิง", "สมุนไพร",
    ];
    for (const s of identifiers) expect(prompt, `พบ "${s}"`).not.toContain(s);
    expect(prompt).not.toMatch(/\d{7,}/);
  });

  it("ไม่ส่ง free text (CC/HPI/PMH/วินิจฉัยแรกรับที่พิมพ์/Course)", () => {
    for (const t of [FAKE.screen!.cc!, FAKE.screen!.hpi!, FAKE.screen!.pmh!, FAKE.prediag!, COURSE]) {
      for (const part of t.split(/\s+/).filter((w) => w.length >= 4 && /[฀-๿]/.test(w))) {
        expect(prompt, `พบ "${part}"`).not.toContain(part);
      }
    }
    expect(prompt).toContain("not sent");
  });

  it("อายุ ≥ 90 เป็น 90+", () => {
    expect(c.age).toBe("90+");
    expect(deidentify({ ...FAKE, ageYears: 89 }).age).toBe("89");
    expect(deidentify({ ...FAKE, ageYears: null }).age).toBe("unknown");
  });

  it("วันที่เป็นวันของการนอน (D1 = วัน admit)", () => {
    expect(c.procedures).toEqual([{ code: "96.04", name: "ETT", day: 2 }]);
    expect(c.labs[0]).toMatchObject({ test: "Potassium", value: "2.9", day: 1, flag: "L" });
    expect(c.drugs[0]).toMatchObject({ name: "Ceftriaxone inj 1 g", firstDay: 1 });
  });

  it("ตัดผล lab ที่เป็นข้อความอิสระ/ตัวเลขยาว และชื่อภาษาไทยทิ้ง", () => {
    expect(c.labs.map((l) => l.test)).toEqual(["Potassium"]);
    expect(c.drugs.map((d) => d.name)).toEqual(["Ceftriaxone inj 1 g", "Elixir KCl 15 ml"]);
  });

  it("เก็บข้อมูลมีโครงสร้างที่จำเป็นไว้", () => {
    expect(c).toMatchObject({ sex: "M", losDays: 5, stillAdmitted: false });
    expect(c.vitals).toMatchObject({ bps: 150, bpd: 90, pulse: 110 });
    expect(c.diagnoses.map((d) => d.code)).toEqual(["J18.9", "I10"]);
    expect(c.admitDx.map((d) => d.code)).toEqual(["J18.9"]);
    expect(c.hints.map((h) => h.code)).toContain("E87.6");
  });

  it("assertNoIdentifiers throw ถ้ามีอะไรหลุด", () => {
    expect(() => assertNoIdentifiers(prompt, FAKE, [COURSE])).not.toThrow();
    for (const leak of [FAKE.hn, "นายสมมติ", "2026-09-01", "1/9/2569", "Fakename", "081-234-5678", FAKE.screen!.hpi!, COURSE]) {
      expect(() => assertNoIdentifiers(`${prompt}\n${leak}`, FAKE, [COURSE]), leak).toThrow(DeidentificationError);
    }
  });

  it("ข้อมูลสมมติทุกรายในโหมด demo ผ่านการตรวจ", () => {
    for (const a of buildDemoAdmissions("2026-10-08")) {
      expect(() => promptFor(a), a.an).not.toThrow();
    }
  });
});
