// lib/hosxp/thai.ts
// HOSxP บาง site เก็บภาษาไทย (TIS-620) ไว้ในคอลัมน์ latin1
// ถ้าต่อด้วย charset latin1 จะได้สตริงที่แต่ละตัวอักษรคือ 1 byte ของ TIS-620
// → แปลงกลับเป็น byte แล้ว decode ด้วย windows-874 (superset ของ TIS-620)

const decoder = new TextDecoder("windows-874");

export function latin1ToThai(s: string): string {
  // ถ้าไม่มี byte ช่วง 0xA1-0xFB เลย แปลว่าเป็น ASCII ล้วน ไม่ต้องแปลง
  if (!/[¡-û]/.test(s)) return s;
  return decoder.decode(Buffer.from(s, "latin1"));
}

/** แปลงทุกฟิลด์ที่เป็นสตริงในแถว (ใช้เมื่อ HOSXP_DB_CHARSET=latin1) */
export function fixRowThai<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = typeof v === "string" ? latin1ToThai(v) : v;
  }
  return out as T;
}
