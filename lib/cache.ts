// lib/cache.ts
// cachedQuery([keyParts], fn, ttl) + invalidate(prefix) — API เดียวกับ ppc-hos-10667
// - Redis ล่ม/ไม่ได้ตั้งค่า → เรียก fn ตรง (ไม่ fail ทั้งหน้า)
// - กัน stampede ภายใน process: key เดียวกันที่กำลังโหลดอยู่ จะรอผลเดียวกัน
// ⚠️ ห้าม cache ข้อมูลที่ยังไม่ผ่าน deidentify เพื่อส่ง AI — cache นี้ใช้กับผล query จาก HOSxP เท่านั้น

import { getRedis } from "./redis";

const PREFIX = "ipdsum:";
const inflight = new Map<string, Promise<unknown>>();

function buildKey(parts: (string | number | boolean | null | undefined)[]): string {
  return PREFIX + parts.map((p) => (p == null ? "" : String(p))).join(":");
}

export async function cachedQuery<T>(
  keyParts: (string | number | boolean | null | undefined)[],
  fn: () => Promise<T>,
  ttlSeconds: number,
): Promise<T> {
  const key = buildKey(keyParts);
  const redis = getRedis();

  if (redis) {
    try {
      const hit = await redis.get(key);
      if (hit != null) return JSON.parse(hit) as T;
    } catch {
      // Redis มีปัญหา → ไปโหลดจริง
    }
  }

  const running = inflight.get(key);
  if (running) return running as Promise<T>;

  const p = (async () => {
    try {
      const value = await fn();
      if (redis) {
        try {
          await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
        } catch {
          // เขียน cache ไม่ได้ไม่เป็นไร
        }
      }
      return value;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

/** ลบ cache ทุก key ที่ขึ้นต้นด้วย prefix (เช่น ["patient", an]) */
export async function invalidate(prefixParts: (string | number)[]): Promise<number> {
  const redis = getRedis();
  if (!redis) return 0;
  const match = buildKey(prefixParts) + "*";
  let cursor = "0";
  let removed = 0;
  try {
    do {
      const [next, keys] = await redis.scan(cursor, "MATCH", match, "COUNT", 200);
      cursor = next;
      if (keys.length) removed += await redis.del(...keys);
    } while (cursor !== "0");
  } catch {
    // ไม่มี cache ให้ลบก็ไม่เป็นไร
  }
  return removed;
}
