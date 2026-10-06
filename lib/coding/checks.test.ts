import { describe, expect, it } from "vitest";
import { buildCodebook } from "./codebook";
import { checkCodeSet, type CodeSet, type CodingRule } from "./checks";
import { normalizeIcd10, normalizeIcd9 } from "./icd";

const books = {
  icd10: buildCodebook("ICD10", "code,description\nJ18.9,x\nE87.6,x\nR50.9,x\nN39.0,x\nI10,x\nI50.0,x\nI50.9,x\nS72.0,x\nW19,x\nG63.2,x\nE11.4,x\nI69.4,x\nS06.0,x", "t", false),
  icd9: buildCodebook("ICD9CM", "code,description\n47.09,x", "t", false),
};

function rules(set: CodeSet): CodingRule[] {
  return checkCodeSet(set, books).map((i) => i.rule);
}

describe("normalize", () => {
  it("ICD-10", () => {
    expect(normalizeIcd10("j189")).toBe("J18.9");
    expect(normalizeIcd10("G63.2*")).toBe("G63.2");
    expect(normalizeIcd10("i10")).toBe("I10");
  });
  it("ICD-9-CM", () => {
    expect(normalizeIcd9("4709")).toBe("47.09");
    expect(normalizeIcd9("47.09")).toBe("47.09");
  });
});

describe("checkCodeSet", () => {
  it("ชุดรหัสปกติไม่มีปัญหา", () => {
    expect(rules({ diagnoses: [{ code: "J18.9", diagtype: "1" }, { code: "E87.6", diagtype: "2" }], procedures: [] })).toEqual([]);
  });
  it("ไม่มี PDx", () => {
    expect(rules({ diagnoses: [{ code: "E87.6", diagtype: "2" }], procedures: [] })).toContain("NO_PDX");
  });
  it("MB2 หลาย PDx", () => {
    expect(rules({ diagnoses: [{ code: "J18.9", diagtype: "1" }, { code: "I50.0", diagtype: "1" }], procedures: [] })).toContain("MB2");
  });
  it("MB1 ภาวะเรื้อรังเป็น PDx", () => {
    expect(rules({ diagnoses: [{ code: "I10", diagtype: "1" }, { code: "J18.9", diagtype: "2" }], procedures: [] })).toContain("MB1");
  });
  it("MB3 อาการเป็น PDx", () => {
    expect(rules({ diagnoses: [{ code: "R50.9", diagtype: "1" }, { code: "N39.0", diagtype: "2" }], procedures: [] })).toContain("MB3");
  });
  it("MB4 PDx ไม่เฉพาะเจาะจง", () => {
    expect(rules({ diagnoses: [{ code: "I50.9", diagtype: "1" }, { code: "I50.0", diagtype: "2" }], procedures: [] })).toContain("MB4");
  });
  it("asterisk เป็น PDx และคู่ dagger", () => {
    const r = rules({ diagnoses: [{ code: "G63.2", diagtype: "1" }], procedures: [] });
    expect(r).toContain("ASTERISK_AS_PDX");
    expect(r).toContain("ASTERISK_PAIR");
    expect(rules({ diagnoses: [{ code: "E11.4", diagtype: "1" }, { code: "G63.2", diagtype: "2" }], procedures: [] })).not.toContain("ASTERISK_PAIR");
  });
  it("sequelae เป็น PDx", () => {
    expect(rules({ diagnoses: [{ code: "I69.4", diagtype: "1" }], procedures: [] })).toContain("SEQUELAE_AS_PDX");
  });
  it("บาดเจ็บต้องมีสาเหตุภายนอก", () => {
    expect(rules({ diagnoses: [{ code: "S06.0", diagtype: "1" }], procedures: [] })).toContain("INJURY_NO_EXTERNAL_CAUSE");
    expect(rules({ diagnoses: [{ code: "S72.0", diagtype: "1" }, { code: "W19", diagtype: "5" }], procedures: [] })).toEqual([]);
  });
  it("สาเหตุภายนอกเป็น PDx / ประเภทผิด", () => {
    expect(rules({ diagnoses: [{ code: "W19", diagtype: "1" }, { code: "S72.0", diagtype: "2" }], procedures: [] })).toContain("EXTERNAL_CAUSE_AS_PDX");
    expect(rules({ diagnoses: [{ code: "S72.0", diagtype: "1" }, { code: "W19", diagtype: "2" }], procedures: [] })).toContain("EXTERNAL_CAUSE_DIAGTYPE");
  });
  it("รหัสที่ไม่มีใน codebook ต้องเตือน", () => {
    const issues = checkCodeSet({ diagnoses: [{ code: "J18.9", diagtype: "1" }, { code: "K29.7", diagtype: "2" }], procedures: [{ code: "99.04" }] }, books);
    expect(issues.filter((i) => i.rule === "NOT_IN_CODEBOOK").flatMap((i) => i.codes)).toEqual(["K29.7", "99.04"]);
  });
  it("รูปแบบรหัสผิด", () => {
    expect(rules({ diagnoses: [{ code: "XYZ", diagtype: "1" }], procedures: [] })).toContain("INVALID_FORMAT");
  });
  it("ไม่มี codebook ต้องเตือน", () => {
    const empty = { icd10: buildCodebook("ICD10", null, null, false), icd9: buildCodebook("ICD9CM", null, null, false) };
    expect(checkCodeSet({ diagnoses: [{ code: "J18.9", diagtype: "1" }], procedures: [] }, empty).map((i) => i.rule)).toContain("NO_CODEBOOK");
  });
});
