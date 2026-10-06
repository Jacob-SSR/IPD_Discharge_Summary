// lib/auth/rateLimit.ts
// จำกัดจำนวนครั้งแบบ fixed window — ใช้ Redis ถ้ามี (แชร์ทุก instance) ไม่มีก็ใช้หน่วยความจำ

import { getRedis } from "@/lib/redis";

export interface RateLimitResult {
  ok: boolean;
  retryAfterSec: number;
}

const memory = new Map<string, { count: number; resetAt: number }>();

export async function rateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const redis = getRedis();
  const rkey = `ipdsum:rl:${key}`;
  if (redis) {
    try {
      const count = await redis.incr(rkey);
      if (count === 1) await redis.pexpire(rkey, windowMs);
      if (count > limit) {
        const ttl = await redis.pttl(rkey);
        return { ok: false, retryAfterSec: Math.max(1, Math.ceil(ttl / 1000)) };
      }
      return { ok: true, retryAfterSec: 0 };
    } catch {
      // Redis ล่ม → ใช้หน่วยความจำแทน
    }
  }
  const now = Date.now();
  const cur = memory.get(rkey);
  if (!cur || cur.resetAt <= now) {
    memory.set(rkey, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSec: 0 };
  }
  cur.count += 1;
  if (cur.count > limit) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((cur.resetAt - now) / 1000)) };
  }
  return { ok: true, retryAfterSec: 0 };
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
