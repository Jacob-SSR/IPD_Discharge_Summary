import { Suspense } from "react";
import { hospitalName, isDemo } from "@/lib/env";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-mint-50 to-mint-100 px-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-lg shadow-mint-800/5">
        <h1 className="text-lg font-semibold text-mint-800">IPD Discharge Summary</h1>
        <p className="mb-6 text-sm text-slate-500">{hospitalName()}</p>
        <Suspense>
          <LoginForm demo={isDemo()} />
        </Suspense>
      </div>
    </div>
  );
}
