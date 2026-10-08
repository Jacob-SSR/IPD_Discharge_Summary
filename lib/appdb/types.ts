// lib/appdb/types.ts
// ฐานข้อมูลของแอปเอง (แยกจาก HOSxP) — เก็บการตัดสินใจรหัส, ผล AI (ไม่มีข้อมูลระบุตัวตน), Course, audit log
// ⚠️ ห้ามเก็บ payload ที่ส่ง AI ถ้ายังมีข้อมูลระบุตัวตน — ai_runs.result เก็บเฉพาะผลลัพธ์ที่ผ่าน deidentify แล้ว

import type { DiagType, OrType } from "@/lib/patients/types";

export type CodeSystem = "ICD10" | "ICD9CM";
export type DecisionSource = "ai" | "rules" | "manual";
/** accept/reject = ตัดสินรหัสที่ระบบเสนอ, add = แพทย์เพิ่มเอง, remove = ลบรหัสที่เพิ่มเอง */
export type DecisionAction = "accept" | "reject" | "add" | "remove";
export type AiRunKind = "suggest" | "course";

export interface CodeDecision {
  id: number;
  an: string;
  code: string;
  system: CodeSystem;
  source: DecisionSource;
  action: DecisionAction;
  diagtype: DiagType | null;
  orType: OrType | null;
  opDate: string | null;
  provider: string | null;
  model: string | null;
  aiRunId: number | null;
  decidedBy: string;
  /** ISO datetime */
  decidedAt: string;
}

export type NewCodeDecision = Omit<CodeDecision, "id" | "decidedAt">;

export interface AiRun {
  id: number;
  an: string;
  kind: AiRunKind;
  provider: string;
  model: string | null;
  fallbackReason: string | null;
  nSuggestions: number;
  nDroppedNoEvidence: number;
  nNotInCodebook: number;
  /** ผลลัพธ์ที่ไม่มีข้อมูลระบุตัวตน (รายการรหัส/ร่าง Course) */
  result: unknown;
  createdBy: string;
  createdAt: string;
}

export type NewAiRun = Omit<AiRun, "id" | "createdAt">;

export interface CourseText {
  an: string;
  text: string;
  source: DecisionSource;
  updatedBy: string;
  updatedAt: string;
}

export interface AuditEntry {
  id: number;
  at: string;
  username: string;
  action: string;
  an: string | null;
  detail: string | null;
}

export interface UserRecord {
  user: string;
  passweb: string;
  name: string | null;
  role: string | null;
}

export interface AppDb {
  readonly kind: "mysql" | "file";
  ping(): Promise<void>;

  findUser(username: string): Promise<UserRecord | null>;
  upsertUser(u: UserRecord): Promise<void>;
  /** เปลี่ยนเฉพาะรหัสผ่าน (ไม่แตะคอลัมน์อื่นของตารางผู้ใช้ที่ใช้ร่วมกับ ppc-hos) */
  updatePassword(username: string, passweb: string): Promise<void>;

  addDecision(d: NewCodeDecision): Promise<CodeDecision>;
  listDecisions(an: string): Promise<CodeDecision[]>;
  /** วันที่ตัดสินใจอยู่ในช่วง [from, to] (ISO date) */
  listDecisionsInRange(from: string, to: string): Promise<CodeDecision[]>;

  addAiRun(r: NewAiRun): Promise<AiRun>;
  latestAiRun(an: string, kind: AiRunKind): Promise<AiRun | null>;
  listAiRunsInRange(from: string, to: string): Promise<AiRun[]>;

  getCourse(an: string): Promise<CourseText | null>;
  saveCourse(c: Omit<CourseText, "updatedAt">): Promise<CourseText>;

  audit(e: Omit<AuditEntry, "id" | "at">): Promise<void>;
}
