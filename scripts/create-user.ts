// scripts/create-user.ts
// สร้าง/แก้ไขบัญชีผู้ใช้ในฐานข้อมูลแอป (ไม่ใช่ HOSxP)
//   npm run create-user -- <username> <role> "<ชื่อที่แสดง>"
//   role: DOCTOR (ยืนยันรหัสได้) | ADMIN | USER (ดูอย่างเดียว)
// รหัสผ่านถามทางหน้าจอ ไม่รับทาง argument (กันค้างใน shell history)

import { createInterface } from "node:readline/promises";
import { appDb } from "@/lib/appdb";
import { hashPassword } from "@/lib/auth/password";

async function main() {
  const [username, role = "USER", ...nameParts] = process.argv.slice(2);
  if (!username || !/^[A-Za-z0-9._-]{1,50}$/.test(username)) {
    console.error('ใช้งาน: npm run create-user -- <username> <DOCTOR|ADMIN|USER> "<ชื่อที่แสดง>"');
    process.exit(1);
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const password = await rl.question("รหัสผ่าน (อย่างน้อย 8 ตัว): ");
  rl.close();
  if (password.length < 8) {
    console.error("รหัสผ่านสั้นเกินไป");
    process.exit(1);
  }
  await appDb().upsertUser({
    user: username,
    passweb: await hashPassword(password),
    name: nameParts.join(" ") || null,
    role: role.toUpperCase(),
  });
  console.log(`บันทึกผู้ใช้ ${username} (${role.toUpperCase()}) แล้ว`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
