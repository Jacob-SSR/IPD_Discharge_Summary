import { Suspense } from "react";
import { Activity } from "lucide-react";
import { BlurText } from "@/components/motion";
import { hospitalName, isDemo } from "@/lib/env";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      {/* Aurora: แสงเคลื่อนช้าๆ ด้านหลัง (CSS ล้วน หยุดเองเมื่อผู้ใช้ตั้ง reduced motion) */}
      <div className="aurora" aria-hidden>
        <i />
        <i />
        <i />
      </div>
      <div className="glass w-full max-w-sm rounded-2xl p-8 shadow-xl">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-[var(--accent-ink)]">
            <Activity size={22} />
          </span>
          <div className="leading-tight">
            <h1 className="text-lg font-semibold">
              <span className="grad-text">AI แนะนำรหัส</span>
            </h1>
            <p className="text-xs text-muted">
              <BlurText text={`IPD Discharge Summary · ${hospitalName()}`} />
            </p>
          </div>
        </div>
        <Suspense>
          <LoginForm demo={isDemo()} />
        </Suspense>
      </div>
    </div>
  );
}
