// components/AppShell.tsx — แถบเมนูด้านบน + ป้ายโหมด + ผู้ใช้
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Activity, BarChart3, BrainCircuit, ClipboardList, LogOut, PlugZap } from "lucide-react";

const NAV = [
  { href: "/patients", label: "ผู้ป่วยใน", icon: ClipboardList },
  { href: "/reports/rw", label: "รายงาน RW/CMI", icon: BarChart3 },
  { href: "/reports/ai", label: "ผลงาน AI", icon: BrainCircuit },
  { href: "/system", label: "ตรวจการเชื่อมต่อ", icon: PlugZap },
];

export function AppShell({
  user,
  mode,
  hospital,
  children,
}: {
  user: { username: string; name: string | null; role: string };
  mode: "demo" | "hosxp";
  hospital: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }
  return (
    <div className="min-h-screen">
      <header className="no-print sticky top-0 z-20 border-b border-mint-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/patients" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-mint-600 text-white">
              <Activity size={18} />
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-semibold text-mint-800">IPD Discharge Summary</span>
              <span className="block text-[11px] text-slate-500">{hospital}</span>
            </span>
          </Link>
          <nav className="flex flex-wrap gap-1">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm ${
                    active ? "bg-mint-100 font-medium text-mint-800" : "text-slate-600 hover:bg-mint-50"
                  }`}
                >
                  <Icon size={15} />
                  {label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            {mode === "demo" ? (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900" title="ใช้ข้อมูลสมมติ ไม่ได้ต่อ HOSxP">
                โหมด DEMO · ข้อมูลสมมติ
              </span>
            ) : (
              <span className="rounded-full bg-mint-100 px-2.5 py-0.5 text-xs font-semibold text-mint-800">HOSxP (อ่านอย่างเดียว)</span>
            )}
            <span className="text-slate-600">
              {user.name ?? user.username} <span className="text-xs text-slate-400">({user.role})</span>
            </span>
            <button onClick={logout} className="flex items-center gap-1 rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100" title="ออกจากระบบ">
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </header>
      <main className="print-area mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
