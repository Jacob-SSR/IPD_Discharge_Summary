"use client";

import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { buttonClass, ErrorBox, inputClass } from "@/components/ui";

export function LoginForm({ demo }: { demo: boolean }) {
  const next = useSearchParams().get("next");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) {
      setError(body.error ?? "เข้าสู่ระบบไม่สำเร็จ");
      return;
    }
    // ไปได้เฉพาะ path ภายในระบบ
    window.location.href = next && next.startsWith("/") && !next.startsWith("//") ? next : "/patients";
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm text-slate-600">
        ชื่อผู้ใช้
        <input className={inputClass} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus required />
      </label>
      <label className="flex flex-col gap-1 text-sm text-slate-600">
        รหัสผ่าน
        <input className={inputClass} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
      </label>
      {error && <ErrorBox message={error} />}
      <button className={buttonClass("primary")} disabled={busy}>
        {busy ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
      </button>
      {demo && <p className="text-center text-xs text-amber-700">โหมด demo — ใช้บัญชีจาก DEMO_USERNAME / DEMO_PASSWORD ใน .env.local</p>}
    </form>
  );
}
