// app/(app)/layout.tsx — ทุกหน้าที่ต้อง login (proxy.ts กันไว้ชั้นหนึ่งแล้ว ตรงนี้ตรวจซ้ำ)
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { getSession } from "@/lib/auth/session";
import { appMode, hospitalName } from "@/lib/env";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await getSession();
  if (!session) redirect("/login");
  return (
    <AppShell user={session} mode={appMode()} hospital={hospitalName()}>
      {children}
    </AppShell>
  );
}
