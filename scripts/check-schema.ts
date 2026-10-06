// scripts/check-schema.ts
// เทียบตาราง/ฟิลด์ที่ lib/hosxp/queries.ts ใช้ (lib/hosxp/schema.ts) กับ INFORMATION_SCHEMA ของ HOSxP จริง
// พิมพ์เฉพาะชื่อตาราง/ฟิลด์ ไม่อ่านและไม่พิมพ์ข้อมูลผู้ป่วย
//
// รันบนเครื่องใน LAN ที่ต่อ HOSxP ได้:  npm run check-schema   (อ่านค่าจาก .env.local)

import { closeHosxpPool, hosxpPing, hosxpQuery } from "@/lib/hosxp/pool";
import { HOSXP_COLUMNS } from "@/lib/hosxp/schema";

async function main() {
  const ping = await hosxpPing();
  console.log(`HOSxP: ${ping.version} · ฐาน ${ping.database}\n`);

  const tables = Object.keys(HOSXP_COLUMNS);
  const rows = await hosxpQuery<{ TABLE_NAME: string; COLUMN_NAME: string }>(
    `SELECT TABLE_NAME, COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (${tables.map(() => "?").join(",")})`,
    tables,
  );

  const actual = new Map<string, Set<string>>();
  for (const r of rows) {
    const t = r.TABLE_NAME.toLowerCase();
    if (!actual.has(t)) actual.set(t, new Set());
    actual.get(t)!.add(r.COLUMN_NAME.toLowerCase());
  }

  let problems = 0;
  for (const [table, cols] of Object.entries(HOSXP_COLUMNS)) {
    const have = actual.get(table.toLowerCase());
    if (!have) {
      console.log(`✗ ไม่มีตาราง ${table}`);
      problems++;
      continue;
    }
    const missing = cols.filter((c) => !have.has(c.toLowerCase()));
    if (missing.length) {
      console.log(`✗ ${table}: ไม่มีฟิลด์ ${missing.join(", ")}`);
      problems += missing.length;
    } else {
      console.log(`✓ ${table}`);
    }
  }

  console.log(problems ? `\nพบ ${problems} จุดที่ต้องปรับ queries ให้ตรงกับ HOSxP ของโรงพยาบาล` : "\nตาราง/ฟิลด์ครบทุกจุด");
  await closeHosxpPool();
  process.exit(problems ? 1 : 0);
}

main().catch(async (e) => {
  console.error("ตรวจไม่สำเร็จ:", e instanceof Error ? e.message : e);
  await closeHosxpPool();
  process.exit(2);
});
