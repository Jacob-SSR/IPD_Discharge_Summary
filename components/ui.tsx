// components/ui.tsx — component กลาง (แบบ ppc-hos-10667): SectionCard, KpiCard, Badge, ปุ่ม, ข้อความเตือน AI
import type { ReactNode } from "react";
import { Info, type LucideIcon } from "lucide-react";

export function SectionCard({
  title,
  icon: Icon,
  actions,
  children,
  className = "",
}: {
  title: ReactNode;
  icon?: LucideIcon;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-md border border-mint-100 bg-white p-5 shadow-sm ${className}`}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {Icon && <Icon size={16} className="text-mint-700" />}
        <h2 className="text-[17px] font-semibold text-mint-800" style={{ fontFamily: "var(--serif)" }}>{title}</h2>
        {actions && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

export function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = "mint",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: LucideIcon;
  tone?: "mint" | "amber" | "slate" | "rose";
}) {
  const tones = {
    mint: "bg-mint-50 text-mint-800",
    amber: "bg-amber-50 text-amber-800",
    slate: "bg-slate-50 text-slate-700",
    rose: "bg-rose-50 text-rose-800",
  } as const;
  return (
    <div className={`flex flex-col gap-1 rounded-md p-4 ${tones[tone]}`}>
      <div className="flex items-center gap-2 text-xs font-semibold">
        {Icon && <Icon size={15} />}
        {label}
      </div>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      {sub && <div className="text-xs opacity-75">{sub}</div>}
    </div>
  );
}

const BADGE = {
  mint: "bg-mint-100 text-mint-800",
  amber: "bg-amber-100 text-amber-900",
  rose: "bg-rose-100 text-rose-800",
  slate: "bg-slate-100 text-slate-700",
  sky: "bg-sky-100 text-sky-800",
  violet: "bg-violet-100 text-violet-800",
} as const;

export function Badge({ children, tone = "slate", title }: { children: ReactNode; tone?: keyof typeof BADGE; title?: string }) {
  return (
    <span title={title} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${BADGE[tone]}`}>
      {children}
    </span>
  );
}

const BTN = {
  primary: "bg-mint-600 text-white hover:bg-mint-700 disabled:bg-mint-300",
  secondary: "border border-mint-200 bg-white text-mint-800 hover:bg-mint-50 disabled:text-slate-400",
  danger: "border border-rose-200 bg-white text-rose-700 hover:bg-rose-50 disabled:text-slate-400",
  ghost: "text-mint-800 hover:bg-mint-50 disabled:text-slate-400",
} as const;

export function buttonClass(variant: keyof typeof BTN = "secondary", size: "sm" | "md" = "md"): string {
  const sz = size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-2 text-sm";
  return `inline-flex items-center justify-center gap-1.5 rounded font-medium transition-colors disabled:cursor-not-allowed ${sz} ${BTN[variant]}`;
}

/** ข้อความบังคับในทุกหน้าที่แสดงคำแนะนำจาก AI (กฎข้อ 6) */
export function AiDisclaimer({ className = "", kind = "codes" }: { className?: string; kind?: "codes" | "course" }) {
  return (
    <div className={`flex items-start gap-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 ${className}`}>
      <Info size={15} className="mt-0.5 shrink-0" />
      {kind === "codes" ? (
        <p>
          <b>รหัสที่ระบบแนะนำเป็นเพียงข้อเสนอแนะ ไม่ใช่การวินิจฉัย</b> — แพทย์ต้องตรวจสอบกับเวชระเบียนและกดยืนยันทีละรหัส
          ระบบไม่ยอมรับรหัสให้อัตโนมัติ และไม่บันทึกลง HOSxP
        </p>
      ) : (
        <p>
          <b>ร่างนี้เป็นเพียงข้อเสนอแนะ ไม่ใช่การวินิจฉัย</b> — สร้างจากข้อมูลมีโครงสร้างเท่านั้น แพทย์ต้องตรวจและแก้ไขก่อนบันทึก
        </p>
      )}
    </div>
  );
}

export function Spinner({ label = "กำลังโหลด…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-6 text-sm text-mint-700">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-mint-200 border-t-mint-600" />
      {label}
    </div>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return <div className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{message}</div>;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="py-10 text-center text-sm text-slate-500">{children}</div>;
}

export const inputClass =
  "rounded border border-mint-200 bg-white px-3 py-2 text-sm outline-none focus:border-mint-500 focus:ring-2 focus:ring-mint-100";
