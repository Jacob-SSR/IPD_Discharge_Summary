// lib/patients/bundle.ts — ชนิดข้อมูลที่ API หน้า Discharge Summary ส่งให้ browser (type อย่างเดียว)

import type { AiStatus } from "@/lib/ai";
import type { SuggestResult } from "@/lib/ai/types";
import type { CodeDecision, CourseText } from "@/lib/appdb/types";
import type { CodingIssue } from "@/lib/coding/checks";
import type { FinalCode } from "@/lib/coding/final";
import type { GroupEstimate } from "@/lib/drg/estimate";
import type { AdmissionDetail } from "./types";

export interface RefInfo {
  source: string | null;
  isDemo: boolean;
  size: number;
}

export interface SummaryBundle {
  admission: AdmissionDetail;
  course: CourseText | null;
  decisions: CodeDecision[];
  suggest: SuggestResult | null;
  ai: AiStatus;
  canDecide: boolean;
  hospitalName: string;
  reference: {
    icd10: RefInfo;
    icd9: RefInfo;
    tdrg: RefInfo & { formulaVerified: boolean };
  };
}

export interface CheckBundle {
  final: FinalCode[];
  issues: CodingIssue[];
  estimate: { before: GroupEstimate; after: GroupEstimate };
}
