// lib/redis.ts
// Redis เป็นของเสริม — ถ้าไม่ได้ตั้ง REDIS_URL (เช่นโหมด demo บนเครื่องตัวเอง) ระบบทำงานต่อได้โดยไม่มี cache

import Redis from "ioredis";
import { redisUrl } from "@/lib/env";

let client: Redis | null | undefined;

export function getRedis(): Redis | null {
  if (client !== undefined) return client;
  const url = redisUrl();
  if (!url) {
    client = null;
    return client;
  }
  client = new Redis(url, {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    lazyConnect: false,
  });
  // อย่าให้ error ของ Redis ทำ process ล่ม — cache พังแล้วไป query ตรงแทน
  client.on("error", () => {});
  return client;
}
