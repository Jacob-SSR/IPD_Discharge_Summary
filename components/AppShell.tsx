// components/AppShell.tsx — แถบเมนูด้านบน + ป้ายโหมด + ผู้ใช้
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Activity, BarChart3, BrainCircuit, ClipboardList, LogOut, PlugZap } from "lucide-react";

const NAV = [
  { href: "/patients", label: "สรุป + AI แนะนำรหัส", icon: ClipboardList },
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
      <header className="no-print glass sticky top-0 z-20 border-x-0 border-t-0">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2">
          <Link href="/patients" className="group flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-[var(--accent-ink)] transition-transform group-hover:rotate-[-8deg] group-hover:scale-105">
              <Activity size={18} />
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-semibold text-ink">IPD Discharge Summary</span>
              <span className="block text-[11px] text-muted">{hospital}</span>
            </span>
          </Link>
          <nav className="flex flex-wrap gap-1">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                    active ? "bg-accent-soft font-medium text-accent" : "text-muted hover:bg-surface-2 hover:text-ink"
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
      <main className="print-area mx-auto max-w-[1440px] px-4 pt-3 pb-8">{children}</main>
    </div>
  );
}
