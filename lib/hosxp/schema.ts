// lib/hosxp/schema.ts
// ตาราง/ฟิลด์ของ HOSxP ที่ queries.ts ใช้ทั้งหมด — scripts/check-schema.ts ใช้รายการนี้
// เทียบกับ INFORMATION_SCHEMA ของโรงพยาบาลจริง (ต้องแก้ไฟล์นี้ทุกครั้งที่แก้ queries.ts)
//
// ยืนยันแล้วจาก ppc-hos-10667 ที่รันกับ HOSxP ของโรงพยาบาลจริง:
//   ipt.dch_doctor, an_stat.aid → thaiaddress.addressid/full_name, an_stat.pttype, iptoprt.icd9 (ไม่มีจุด)
// คอลัมน์ที่ต่างกันตามเวอร์ชัน HOSxP ไม่อยู่ในรายการนี้ — เลือกอัตโนมัติใน lib/hosxp/columns.ts
//   (แพทย์ผู้รับไว้, วันที่/แพทย์ผู้ทำหัตถการ, วันที่สั่งยา, lab_head.an) และ check-schema รายงานว่าเลือกตัวไหน

export const HOSXP_COLUMNS: Record<string, readonly string[]> = {
  ipt: ["an", "hn", "regdate", "regtime", "dchdate", "dchtime", "ward", "dch_doctor", "dchstts", "dchtype"],
  patient: ["hn", "pname", "fname", "lname", "sex", "birthday", "cid", "addrpart", "moopart", "hometel"],
  thaiaddress: ["addressid", "full_name"],
  an_stat: ["an", "age_y", "drg", "rw", "adjrw", "aid", "pttype"],
  ward: ["ward", "name"],
  doctor: ["code", "name"],
  pttype: ["pttype", "name"],
  dchstts: ["dchstts", "name"],
  dchtype: ["dchtype", "name"],
  iptdiag: ["an", "icd10", "diagtype", "doctor"],
  icd101: ["code", "name"],
  iptoprt: ["an", "icd9"],
  icd9cm1: ["code", "name"],
  lab_head: ["lab_order_number", "vn", "order_date"],
  lab_order: ["lab_order_number", "lab_items_code", "lab_order_result"],
  lab_items: ["lab_items_code", "lab_items_name", "lab_items_unit", "lab_items_normal_value"],
  opitemrece: ["an", "icode", "qty"],
  drugitems: ["icode", "name", "strength", "units"],
  // visit ที่ admit (ipt.vn): สัญญาณชีพ/CC แรกรับ + รหัสที่ลงไว้ตอน ER/OPD
  opdscreen: ["vn"],
  ovstdiag: ["vn", "icd10", "diagtype"],
};
