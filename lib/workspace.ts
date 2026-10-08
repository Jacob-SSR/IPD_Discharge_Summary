// lib/workspace.ts
// ประกอบข้อมูลหน้าทำงานของผู้ป่วยหนึ่งราย (ชาร์ต + ข้อเสนอรหัส + DRG/RW) สำหรับ route handler

import { aiStatus, buildWorkspace } from "@/lib/ai";
import { CLINICAL_REVIEWED } from "@/lib/ai/rules.config";
import type { Session } from "@/lib/auth/session";
import { canDecide } from "@/lib/auth/session";
import { getCodebook } from "@/lib/coding/codebook";
import { ADJRW_FORMULA_VERIFIED } from "@/lib/drg/adjrw";
import { getTdrgTables, tdrgRefs } from "@/lib/drg/tables";
import { hospitalCode, hospitalName, hospitalProvince, nhsoRatePerAdjRw } from "@/lib/env";
import type { WorkspaceBundle } from "@/lib/patients/bundle";
import { patientSource } from "@/lib/patients/source";
import { labSummary, medSummary } from "@/lib/patients/summary";
import type { AdmissionDetail } from "@/lib/patients/types";

export async function workspaceBundle(a: AdmissionDetail, session: Session): Promise<WorkspaceBundle> {
  const ws = await buildWorkspace(a, patientSource());
  const icd10 = getCodebook("ICD10");
  const icd9 = getCodebook("ICD9CM");
  const tdrg = getTdrgTables();
  return {
    ...ws,
    labs: labSummary(a.labs),
    meds: medSummary(a.drugs),
    ai: aiStatus(),
    canDecide: canDecide(session),
    hospital: { name: hospitalName(), code: hospitalCode(), province: hospitalProvince() },
    baseRate: nhsoRatePerAdjRw(),
    refs: tdrgRefs().refs,
    reference: {
      icd10: { source: icd10.source, isDemo: icd10.isDemo, size: icd10.size },
      icd9: { source: icd9.source, isDemo: icd9.isDemo, size: icd9.size },
      tdrg: { source: tdrg.source, isDemo: tdrg.isDemo, size: tdrg.rw.size, formulaVerified: ADJRW_FORMULA_VERIFIED },
      rulesReviewed: CLINICAL_REVIEWED,
    },
  };
}
