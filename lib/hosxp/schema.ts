// lib/hosxp/schema.ts
// ตาราง/ฟิลด์ของ HOSxP ที่ queries.ts ใช้ทั้งหมด — scripts/check-schema.ts ใช้รายการนี้
// เทียบกับ INFORMATION_SCHEMA ของโรงพยาบาลจริง (ต้องแก้ไฟล์นี้ทุกครั้งที่แก้ queries.ts)
//
// ฟิลด์ที่ "ยังไม่แน่ใจ" ว่าตรงกับ HOSxP ของโรงพยาบาล ต้องยืนยันตอนต่อจริง (งานข้อ 5):
//   - ipt.dch_doctor           แพทย์ผู้จำหน่าย (บาง site ใช้ชื่ออื่น)
//   - lab_head.vn              ผู้ป่วยในเก็บ AN ไว้ในฟิลด์ vn
//   - iptoprt.opdate / doctor  วันที่และแพทย์ผู้ทำหัตถการ
//   - thaiaddress.addressid    รหัสตำบล 6 หลัก (chwpart+amppart+tmbpart)

export const HOSXP_COLUMNS: Record<string, readonly string[]> = {
  ipt: ["an", "hn", "regdate", "regtime", "dchdate", "dchtime", "ward", "admdoctor", "dch_doctor", "dchstts", "dchtype", "pttype"],
  patient: ["hn", "pname", "fname", "lname", "sex", "birthday", "cid", "addrpart", "moopart", "chwpart", "amppart", "tmbpart", "hometel"],
  thaiaddress: ["addressid", "full_name"],
  an_stat: ["an", "age_y", "drg", "rw", "adjrw"],
  ward: ["ward", "name"],
  doctor: ["code", "name"],
  pttype: ["pttype", "name"],
  dchstts: ["dchstts", "name"],
  dchtype: ["dchtype", "name"],
  iptdiag: ["an", "icd10", "diagtype", "doctor"],
  icd101: ["code", "name"],
  iptoprt: ["an", "icd9", "opdate", "doctor"],
  icd9cm1: ["code", "name"],
  lab_head: ["lab_order_number", "vn", "order_date"],
  lab_order: ["lab_order_number", "lab_items_code", "lab_order_result"],
  lab_items: ["lab_items_code", "lab_items_name", "lab_items_unit", "lab_items_normal_value"],
  opitemrece: ["an", "icode", "rxdate", "qty"],
  drugitems: ["icode", "name", "strength", "units"],
};
