import type { Metadata } from "next";
import { IBM_Plex_Sans_Thai_Looped, JetBrains_Mono, Taviraj } from "next/font/google";
import "./globals.css";

// "กระดาษดิจิทัล" (.impeccable.md): Taviraj = หัวเรื่องใหญ่แบบเอกสารทางการ, IBM Plex Sans Thai Looped = เนื้อหา/UI
// (ไทยมีหัว อ่านง่ายกว่าแบบไม่มีหัวเมื่อตัวเล็ก + ละตินชัดสำหรับชื่อโรคภาษาอังกฤษ), JetBrains Mono = รหัส ICD
const plex = IBM_Plex_Sans_Thai_Looped({ variable: "--font-plex", subsets: ["thai", "latin"], weight: ["400", "500", "600", "700"] });
const taviraj = Taviraj({ variable: "--font-taviraj", subsets: ["thai", "latin"], weight: ["500", "600", "700"] });
const jbmono = JetBrains_Mono({ variable: "--font-jbmono", subsets: ["latin"], weight: ["500", "600"] });

export const metadata: Metadata = {
  title: "AI แนะนำรหัส · IPD Discharge Summary",
  description: "สรุปเวชระเบียนผู้ป่วยใน + AI แนะนำรหัส",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className={`${plex.variable} ${taviraj.variable} ${jbmono.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
