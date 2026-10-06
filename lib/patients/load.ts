// lib/patients/load.ts
import { HttpError } from "@/lib/api";
import { isValidAn, patientSource } from "./source";
import type { AdmissionDetail } from "./types";

export async function loadAdmission(an: string): Promise<AdmissionDetail> {
  if (!isValidAn(an)) throw new HttpError(400, "AN ไม่ถูกต้อง");
  const a = await patientSource().getAdmission(an);
  if (!a) throw new HttpError(404, `ไม่พบ AN ${an}`);
  return a;
}
