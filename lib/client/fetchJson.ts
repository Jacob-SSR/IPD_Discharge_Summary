// lib/client/fetchJson.ts — ใช้ฝั่ง browser: เรียก API แล้วโยน error เป็นข้อความภาษาไทย
"use client";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  if (res.status === 401 && typeof window !== "undefined") {
    // session หมดอายุ → โหลดหน้า login ใหม่ทั้งหน้า (ล้าง state ฝั่ง client) — ฟังก์ชันนี้ไม่ใช่ component จึงใช้ router ไม่ได้
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname)}`);
  }
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new ApiError(res.status, body.error ?? `เกิดข้อผิดพลาด (${res.status})`);
  return body as T;
}
