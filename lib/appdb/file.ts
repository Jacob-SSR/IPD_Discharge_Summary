// lib/appdb/file.ts
// ฐานข้อมูลแอปแบบไฟล์ JSON — ใช้ได้เฉพาะโหมด demo (ไม่ต้องตั้ง MySQL ก็ทดลองได้ครบทุกฟีเจอร์)
// เขียนแบบ atomic (ไฟล์ชั่วคราว → rename) และเข้าคิวทีละคำสั่งภายใน process

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  AiRun,
  AppDb,
  AuditEntry,
  CodeDecision,
  CourseText,
  UserRecord,
} from "./types";

interface FileData {
  seq: { decision: number; aiRun: number; audit: number };
  users: UserRecord[];
  decisions: CodeDecision[];
  aiRuns: AiRun[];
  courses: CourseText[];
  audit: AuditEntry[];
}

function empty(): FileData {
  return {
    seq: { decision: 0, aiRun: 0, audit: 0 },
    users: [],
    decisions: [],
    aiRuns: [],
    courses: [],
    audit: [],
  };
}

const AUDIT_KEEP = 5000;

export function createFileAppDb(file: string): AppDb {
  let queue: Promise<unknown> = Promise.resolve();

  async function load(): Promise<FileData> {
    try {
      return { ...empty(), ...(JSON.parse(await readFile(file, "utf8")) as FileData) };
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return empty();
      throw e;
    }
  }

  async function save(data: FileData): Promise<void> {
    await mkdir(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(data), "utf8");
    await rename(tmp, file);
  }

  /** ทำงานทีละคำสั่ง กันเขียนทับกัน */
  function run<T>(fn: (d: FileData) => T | Promise<T>, write: boolean): Promise<T> {
    const next = queue.then(async () => {
      const data = await load();
      const out = await fn(data);
      if (write) await save(data);
      return out;
    });
    queue = next.catch(() => {});
    return next;
  }

  const now = () => new Date().toISOString();
  const day = (iso: string) => iso.slice(0, 10);

  return {
    kind: "file",
    async ping() {
      await run(() => undefined, false);
    },
    findUser: (username) =>
      run((d) => d.users.find((u) => u.user === username) ?? null, false),
    updatePassword: (username, passweb) =>
      run((d) => {
        d.users = d.users.map((u) => (u.user === username ? { ...u, passweb } : u));
      }, true),
    upsertUser: (u) =>
      run((d) => {
        d.users = [...d.users.filter((x) => x.user !== u.user), u];
      }, true),

    addDecision: (input) =>
      run((d) => {
        const rec: CodeDecision = { ...input, id: ++d.seq.decision, decidedAt: now() };
        d.decisions.push(rec);
        return rec;
      }, true),
    listDecisions: (an) => run((d) => d.decisions.filter((x) => x.an === an), false),
    listDecisionsInRange: (from, to) =>
      run(
        (d) => d.decisions.filter((x) => day(x.decidedAt) >= from && day(x.decidedAt) <= to),
        false,
      ),

    addAiRun: (input) =>
      run((d) => {
        const rec: AiRun = { ...input, id: ++d.seq.aiRun, createdAt: now() };
        d.aiRuns.push(rec);
        return rec;
      }, true),
    latestAiRun: (an, kind) =>
      run((d) => {
        const list = d.aiRuns.filter((r) => r.an === an && r.kind === kind);
        return list.length ? list[list.length - 1] : null;
      }, false),
    listAiRunsInRange: (from, to) =>
      run(
        (d) => d.aiRuns.filter((x) => day(x.createdAt) >= from && day(x.createdAt) <= to),
        false,
      ),

    getCourse: (an) => run((d) => d.courses.find((c) => c.an === an) ?? null, false),
    saveCourse: (c) =>
      run((d) => {
        const rec: CourseText = { ...c, updatedAt: now() };
        d.courses = [...d.courses.filter((x) => x.an !== c.an), rec];
        return rec;
      }, true),

    audit: (e) =>
      run((d) => {
        d.audit.push({ ...e, id: ++d.seq.audit, at: now() });
        if (d.audit.length > AUDIT_KEEP) d.audit = d.audit.slice(-AUDIT_KEEP);
      }, true),
  };
}
