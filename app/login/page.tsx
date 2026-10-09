import { Suspense } from "react";
import { BlurText } from "@/components/motion";
import { hospitalName, isDemo } from "@/lib/env";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

// หน้าเข้าสู่ระบบ: แฟ้มเวชระเบียนบนโต๊ะ (กระดาษดิจิทัล)
export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="login-folder">
        <h1 className="login-title">
          <span className="em">AI</span> แนะนำรหัส
        </h1>
        <svg className="ink-underline" viewBox="0 0 168 10" aria-hidden>
          <path d="M2 7 C 40 2, 90 9, 166 4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
        <p className="mb-6 mt-2 text-sm text-muted">
          <BlurText text={`สรุปเวชระเบียนผู้ป่วยใน · ${hospitalName()}`} />
        </p>
        <Suspense>
          <LoginForm demo={isDemo()} />
        </Suspense>
      </div>
    </div>
  );
}
