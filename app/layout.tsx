import type { Metadata } from "next";
import { Anuphan, JetBrains_Mono, Taviraj } from "next/font/google";
import "./globals.css";

// "กระดาษดิจิทัล" (.impeccable.md): Taviraj = หัวเรื่อง/แบบฟอร์มแบบเอกสารทางการ, Anuphan = เนื้อหา/UI, JetBrains Mono = รหัส ICD
const anuphan = Anuphan({ variable: "--font-anuphan", subsets: ["thai", "latin"], weight: ["400", "500", "600", "700"] });
const taviraj = Taviraj({ variable: "--font-taviraj", subsets: ["thai", "latin"], weight: ["500", "600", "700"] });
const jbmono = JetBrains_Mono({ variable: "--font-jbmono", subsets: ["latin"], weight: ["500", "600"] });

export const metadata: Metadata = {
  title: "AI แนะนำรหัส · IPD Discharge Summary",
  description: "สรุปเวชระเบียนผู้ป่วยใน + AI แนะนำรหัส",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className={`${anuphan.variable} ${taviraj.variable} ${jbmono.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
