// lib/reports/types.ts

export interface RwGroup {
  key: string;
  label: string;
  n: number;
  nWithRw: number;
  sumRw: number;
  sumAdjRw: number;
  cmi: number | null;
}

export interface RwReport {
  from: string;
  to: string;
  totals: RwGroup & { estimatedRevenue: number; ratePerAdjRw: number; nMissingDrg: number };
  byMonth: RwGroup[];
  byWard: RwGroup[];
  byDoctor: RwGroup[];
}

export interface AiPerfGroup {
  key: string;
  label: string;
  runs: number;
  suggested: number;
  accepted: number;
  rejected: number;
  pending: number;
  /** accepted / (accepted + rejected) */
  acceptanceRate: number | null;
}

export interface AiPerfReport {
  from: string;
  to: string;
  totals: AiPerfGroup & {
    manualAdded: number;
    droppedNoEvidence: number;
    notInCodebook: number;
    /** accepted / (accepted + manualAdded) — รหัสที่แพทย์ต้องเพิ่มเองคือรหัสที่ระบบหาไม่เจอ */
    sensitivity: number | null;
    fallbackRuns: number;
  };
  byProvider: AiPerfGroup[];
  topAccepted: { code: string; n: number }[];
  topRejected: { code: string; n: number }[];
  topManual: { code: string; n: number }[];
  rw: {
    cases: number;
    /** รวม (AdjRW ประมาณหลังยืนยัน − ก่อนยืนยัน) */
    adjRwGain: number;
    estimatedRevenueGain: number;
    capped: boolean;
  };
}
