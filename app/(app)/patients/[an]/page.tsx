// ลิงก์เดิม /patients/<AN> → หน้าทำงานที่เลือกผู้ป่วยรายนั้น
import { redirect } from "next/navigation";

export default async function PatientRedirect({ params }: PageProps<"/patients/[an]">) {
  const { an } = await params;
  redirect(`/patients?an=${encodeURIComponent(an)}`);
}
