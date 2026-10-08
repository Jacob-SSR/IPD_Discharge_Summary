// คอลัมน์ขวา: AI แนะนำรหัส — DRG/RW, วิเคราะห์ด้วย AI, ยอมรับ/ไม่ยอมรับทีละรหัส, เพิ่มรหัสเอง, ร่างสรุป, คัดลอกรหัส
// กฎข้อ 6: ไม่มีปุ่ม "ยอมรับทั้งหมด" · ทุกการตัดสินใจบันทึกที่ server ทีละรหัส · มีข้อความว่าเป็นข้อเสนอแนะ ไม่ใช่การวินิจฉัย
"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { nth, ShinyText, sparkAt, spotlight } from "@/components/motion";
import { acceptedItems, norm } from "@/lib/ai/merge";
import type { MergedItem } from "@/lib/ai/types";
import { fetchJson } from "@/lib/client/fetchJson";
import { acceptedLabel, copyText } from "@/lib/coding/final";
import type { CodebookEntry } from "@/lib/coding/codebook";
import { valOf, type Estimate } from "@/lib/drg/estimate";
import type { WorkspaceBundle } from "@/lib/patients/bundle";
import { baht, DT, n4, orClass, orLabel } from "./shared";

interface Props {
  bundle: WorkspaceBundle | null;
  busy: boolean;
  otherBusy: boolean;
  statusMsg: { text: string; err: boolean } | null;
  onAnalyze: () => void;
  onStop: () => void;
  onBundle: (b: WorkspaceBundle) => void;
  onUseDraft: (draft: string) => void;
}

export function AiPanel({ bundle, busy, otherBusy, statusMsg, onAnalyze, onStop, onBundle, onUseDraft }: Props) {
  const [secs, setSecs] = useState(0);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [decErr, setDecErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!busy) return;
    const t0 = Date.now();
    const id = window.setInterval(() => setSecs(Math.round((Date.now() - t0) / 1000)), 500);
    return () => {
      window.clearInterval(id);
      setSecs(0);
    };
  }, [busy]);

  if (!bundle) {
    return (
      <aside className="pane ai" aria-label="AI แนะนำรหัส">
        <div className="ai-head"><h2>AI แนะนำรหัส</h2></div>
        <div className="skeleton" style={{ marginTop: 12 }} />
        <div className="skeleton" />
      </aside>
    );
  }

  const a = bundle.admission;
  const pending = !a.diagnoses.some((d) => d.diagtype === "1");
  const r = bundle.run;
  const aiRun = bundle.aiRun;
  const state = bundle.state;
  const current = bundle.items;
  const man = current.filter((s) => s.source === "manual");
  const fresh = current.filter((s) => !s.already && s.source !== "manual");
  const old = current.filter((s) => s.already);
  const acc = acceptedItems(current, new Map(Object.entries(state)));
  const draft = aiRun?.draft || "";
  const runLabel = pending ? (aiRun ? "ให้ AI ร่างใหม่" : "ให้ AI ร่างรหัส") : aiRun ? "วิเคราะห์ใหม่" : "วิเคราะห์ด้วย AI";
  const aiReady = bundle.ai.active === "gemini";
  const who = bundle.ai.active === "gemini" ? `Gemini · ${bundle.ai.model}` : "กฎหลักฐาน (ยังไม่ได้ตั้งค่า AI)";

  async function decide(body: Record<string, unknown>, key: string, el?: HTMLElement) {
    setPendingKey(key);
    setDecErr(null);
    try {
      const b = await fetchJson<WorkspaceBundle>("/api/decisions", { method: "POST", body: JSON.stringify({ an: a.an, ...body }) });
      if (el && body.op === "accept") sparkAt(el);
      onBundle(b);
      return b;
    } catch (e) {
      setDecErr((e as Error).message);
      return null;
    } finally {
      setPendingKey(null);
    }
  }

  function toggle(s: MergedItem, d: "accepted" | "rejected", e: MouseEvent<HTMLButtonElement>) {
    const op = state[s.key] === d ? "undo" : d === "accepted" ? "accept" : "reject";
    void decide({ op, key: s.key }, s.key, e.currentTarget);
  }

  function copy() {
    const t = copyText(acc);
    navigator.clipboard?.writeText(t).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      },
      () => {
        const el = document.getElementById("accCodes");
        if (!el) return;
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      },
    );
  }

  let status: { text: string; err?: boolean; warn?: boolean } | null = null;
  if (busy) status = null;
  else if (statusMsg) status = statusMsg;
  else if (!aiReady) status = { text: bundle.ai.reason ?? "เรียก AI ไม่ได้ — แสดงเฉพาะผลจากกฎหลักฐาน", err: true };
  else if (r) {
    const at = new Date(r.createdAt).toLocaleString("th-TH", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" });
    status = { text: `วิเคราะห์เมื่อ ${at} · ${r.provider === "gemini" ? (r.model ?? "Gemini") : "กฎหลักฐาน"} · ใช้เวลา ${r.secs} วินาที` };
  }

  return (
    <aside className={`pane ai ${busy ? "beam" : ""}`} aria-label="AI แนะนำรหัส">
      <div className="ai-head">
        <h2>
          <span className="grad-text">AI</span> แนะนำรหัส
        </h2>
        <span className="muted" style={{ fontSize: 12 }}>{who}</span>
      </div>
      <p className="ai-note">
        ข้อความที่ส่งให้ AI ตัดชื่อ/HN/AN/เลขบัตร/วันที่/ชื่อแพทย์ออก และส่งเฉพาะข้อมูลมีโครงสร้าง (รหัส, lab, ยา, หัตถการ, วันนอน, อายุ, เพศ)
        ไม่ส่งข้อความที่แพทย์/พยาบาลพิมพ์เอง · เรียก AI จาก server เท่านั้น
      </p>

      <RwBox b={bundle} />

      <div className="run">
        <button
          className={`btn primary ${aiReady && !busy && !otherBusy && bundle.canDecide ? "ready" : ""}`}
          type="button"
          onClick={onAnalyze} disabled={busy || otherBusy || !aiReady || !bundle.canDecide || !!bundle.promptError}>
          {busy ? "กำลังวิเคราะห์…" : runLabel}
        </button>
        {busy && (
          <button className="btn" type="button" onClick={onStop}>หยุด</button>
        )}
      </div>
      <div className={`status ${status?.err ? "err" : ""}`} role="status">
        {busy ? <ShinyText>AI กำลังอ่านชาร์ต… {secs} วินาที</ShinyText> : status?.text}
      </div>
      {!busy && aiReady && r?.fallbackReason && r.provider === "rules" && <div className="warnline">{r.fallbackReason}</div>}
      {bundle.promptError && <div className="badline">ไม่ส่ง AI: {bundle.promptError}</div>}
      {!bundle.canDecide && <div className="warnline">บัญชีนี้ดูได้อย่างเดียว (ยืนยันรหัสได้เฉพาะ role ใน APP_DECIDER_ROLES)</div>}
      {decErr && <div className="badline" role="alert">{decErr}</div>}

      {busy ? (
        <div style={{ marginTop: 12 }}>
          <div className="skeleton" />
          <div className="skeleton" />
          <div className="skeleton" />
        </div>
      ) : (
        <div key={r?.runId ?? "rules"}>
          <div className="grp">
            <span className="label">{aiRun ? "ข้อเสนอใหม่" : "จากกฎหลักฐาน (ยังไม่ได้ใช้ AI)"}</span>
            <span className="muted" style={{ fontSize: 12 }}>{fresh.length} รายการ</span>
          </div>
          {fresh.length ? (
            <div className="stagger">
              {fresh.map((s, i) => (
                <Sug key={s.key} s={s} i={i} dec={state[s.key]} disabled={!bundle.canDecide || pendingKey != null} onToggle={toggle} />
              ))}
            </div>
          ) : (
            <p className="muted" style={{ fontSize: 13 }}>ไม่มีรหัสเพิ่มเติมที่แนะนำ</p>
          )}
          {man.length > 0 && (
            <>
              <div className="grp">
                <span className="label">แพทย์เพิ่มเอง</span>
                <span className="muted" style={{ fontSize: 12 }}>{man.length} รายการ</span>
              </div>
              <div className="stagger">
                {man.map((s, i) => (
                  <Sug
                    key={s.key}
                    s={s}
                    i={i}
                    dec="accepted"
                    disabled={!bundle.canDecide || pendingKey != null}
                    onDelete={() => void decide({ op: "remove", key: s.key }, s.key)}
                  />
                ))}
              </div>
            </>
          )}
          {aiRun && aiRun.remarks.length > 0 && (
            <>
              <div className="grp"><span className="label">ข้อสังเกตจาก AI</span></div>
              <ul className="remarks">
                {aiRun.remarks.map((x, i) => <li key={i}>{x}</li>)}
              </ul>
            </>
          )}
          {aiRun && aiRun.droppedNoEvidence.length > 0 && (
            <div className="warnline" style={{ marginTop: 8 }}>
              ตัดรหัสที่ AI เสนอแต่ไม่อ้างหลักฐานในชาร์ตออก (กฎหลักฐาน): {aiRun.droppedNoEvidence.join(", ")}
            </div>
          )}
          {old.length > 0 && (
            <details className="old">
              <summary className="grp" style={{ cursor: "pointer" }}>
                <span className="label">{aiRun ? "AI ยืนยันรหัสที่ลงไว้แล้ว" : "รหัสที่ลงไว้แล้ว"} ({old.length})</span>
              </summary>
              {old.map((s, i) => <Sug key={s.key} s={s} i={i} disabled />)}
            </details>
          )}
        </div>
      )}

      {bundle.canDecide && <ManualAdd b={bundle} onAdd={(body) => decide({ op: "add", ...body }, "manual")} />}

      {draft && (
        <div className="draft fade-swap">
          <div className="label">ร่างสรุปการรักษาจาก AI · ตรวจแก้ก่อนใช้</div>
          <p>{draft}</p>
          {bundle.canDecide && (
            <button className="btn" type="button" onClick={() => onUseDraft(draft)}>ใส่ในช่องสรุปการรักษา</button>
          )}
        </div>
      )}

      {acc.length > 0 && (
        <div className="accepted-box fade-swap">
          <div className="label">รหัสที่ยอมรับของผู้ป่วยรายนี้</div>
          <div className="mono" id="accCodes">{acceptedLabel(acc)}</div>
          <div>
            <button className="btn" type="button" onClick={copy}>{copied ? "คัดลอกแล้ว" : "คัดลอกรหัส"}</button>
          </div>
          <div className="hint">ระบบไม่บันทึกลง HOSxP — คัดลอกไปลงใน HOSxP เอง</div>
        </div>
      )}

      <details className="prompt">
        <summary>ดูข้อความที่ส่งให้ AI</summary>
        <pre>{bundle.prompt ?? `ไม่ส่ง AI: ${bundle.promptError ?? "-"}`}</pre>
      </details>

      <div className="disclaimer">
        <b>รหัสที่แนะนำเป็นเพียงข้อเสนอแนะ ไม่ใช่การวินิจฉัย</b> — แพทย์ต้องตรวจกับเวชระเบียนและกดยืนยันทีละรหัส
        ระบบไม่ยอมรับรหัสให้อัตโนมัติ และไม่บันทึกลง HOSxP
      </div>
    </aside>
  );
}

function Sug({
  s,
  i,
  dec,
  disabled,
  onToggle,
  onDelete,
}: {
  s: MergedItem;
  i: number;
  dec?: "accepted" | "rejected";
  disabled?: boolean;
  onToggle?: (s: MergedItem, d: "accepted" | "rejected", e: MouseEvent<HTMLButtonElement>) => void;
  onDelete?: () => void;
}) {
  const pct = Math.round(s.confidence * 100);
  const tag = s.kind === "dx" ? (DT[s.diagtype ?? 0] ?? "Dx") : "ICD-9-CM";
  const src =
    s.source === "manual" ? <span className="tag man">แพทย์เพิ่ม</span>
    : s.source === "ai" ? <span className="tag ai">AI</span>
    : s.source === "ai+rule" ? <span className="tag both">AI + กฎ</span>
    : <span className="tag">กฎ</span>;
  let check = null;
  if (!s.formatOk) check = <div className="badline">รูปแบบรหัสไม่ถูกต้อง</div>;
  else if (!s.inBook) check = <div className="warnline">ไม่อยู่ในตารางรหัสอ้างอิง (ICD-10-TM / ICD-9-CM) — ตรวจรหัสอีกครั้งก่อนยอมรับ</div>;
  return (
    <div className={`sug spot ${dec ?? ""}`} style={nth(i)} onMouseMove={spotlight}>
      <div className="sug-top">
        <span className="code">{s.code}</span>
        <span className={`tag ${s.diagtype === 1 ? "pdx" : ""}`}>{tag}</span>
        {s.kind === "proc" && <span className={`orp ${orClass(s.procClass)}`}>{orLabel(s.procClass)}</span>}
        {src}
        {s.source !== "manual" && (
          <span className="meter" title="ความมั่นใจ">
            <i><b style={{ width: `${pct}%`, ...nth(i) }} /></i>
            {pct}%
          </span>
        )}
      </div>
      {s.name && <div className="nm">{s.name}</div>}
      {check}
      {s.evidenceUnmatched && <div className="warnline">หลักฐานที่ AI อ้างไม่ตรงกับข้อมูลในชาร์ต — ตรวจสอบก่อนยอมรับ</div>}
      <div className="why">{s.reason}</div>
      {s.evidence.length > 0 && (
        <div className="ev">
          {s.evidence.map((e, k) => <span key={k}>{e}</span>)}
        </div>
      )}
      {s.source === "manual" ? (
        <div className="dec">
          <button type="button" className="del" onClick={onDelete} disabled={disabled}>ลบรหัสนี้</button>
          {s.procDate && <span className="hint">วันที่ทำ {s.procDate}</span>}
        </div>
      ) : s.already ? (
        <div className="done">✓ ลงไว้แล้วใน HOSxP</div>
      ) : (
        onToggle && (
          <div className="dec">
            <button type="button" className="yes" aria-pressed={dec === "accepted"} disabled={disabled} onClick={(e) => onToggle(s, "accepted", e)}>
              ✓ ยอมรับ
            </button>
            <button type="button" className="no" aria-pressed={dec === "rejected"} disabled={disabled} onClick={(e) => onToggle(s, "rejected", e)}>
              ✗ ไม่ยอมรับ
            </button>
          </div>
        )
      )}
    </div>
  );
}

function RwBox({ b }: { b: WorkspaceBundle }) {
  const a = b.admission;
  const st = b.rw;
  const rate = b.baseRate;
  const line = (label: string, e: Estimate | null) =>
    e ? (
      <div className="rwl">
        <span>{label}</span>
        <b>
          DRG {e.drg} · {e.adjrw != null ? "AdjRW" : "RW"} {n4(valOf(e))}
          <small>
            {e.note} · ตรงกัน {e.share}% จาก {e.n} ราย ({e.level_th}){e.alts.length ? ` · อาจเป็น ${e.alts.join(", ")}` : ""}
          </small>
        </b>
      </div>
    ) : (
      <div className="rwl"><span>{label}</span><b>ข้อมูลย้อนหลังไม่พอประมาณ</b></div>
    );
  const hasPdx = a.diagnoses.some((d) => d.diagtype === "1");
  return (
    <div className="rwbox">
      <div className="label">DRG / RW</div>
      {a.rw != null && (
        <div className="rwl">
          <span>จริงใน HOSxP (Grouper)</span>
          <b>
            DRG {a.drg} · AdjRW {n4(a.adjrw)}
            <small>≈ {baht(a.adjrw ?? 0, rate)} บาท</small>
          </b>
        </div>
      )}
      {hasPdx ? line(a.rw != null ? "ประมาณจากรหัสปัจจุบัน" : "รหัสปัจจุบัน", st.before) : (
        <div className="rwl"><span>รหัสปัจจุบัน</span><b>ยังไม่มี PDx</b></div>
      )}
      {st.after && line("ถ้าลงรหัสที่ยอมรับ/เพิ่ม", st.after)}
      {st.delta != null ? (
        <div className="rwd fade-swap" key={st.delta}>
          RW {st.delta >= 0 ? "เพิ่มขึ้น" : "เปลี่ยน"} {st.delta >= 0 ? "+" : ""}{n4(st.delta)} · ≈ {baht(st.delta, rate)} บาท
        </div>
      ) : (
        st.after && !st.before && (
          <div className="rwd fade-swap">
            RW โดยประมาณหลังสรุป {n4(valOf(st.after))} · ≈ {baht(valOf(st.after) ?? 0, rate)} บาท
          </div>
        )
      )}
      <details className="refs">
        <summary>วิธีคำนวณและเอกสารอ้างอิง</summary>
        <p>
          DRG ประมาณจากผลจัดกลุ่มจริงย้อนหลังของผู้ป่วยที่มี PDx และโรคร่วมคล้ายกัน (2 ปีงบล่าสุด) · RW คงที่ตามตาราง DRG · AdjRW ตามสูตรเกณฑ์วันนอน
          TDRG 6.3: นอน &lt; 24 ชม. = RW0d, วันนอน &lt; ⌈WtLOS/3⌉ = RW0d + LOS×(RW−RW0d)/⌈WtLOS/3⌉, ถึง OT = RW · มูลค่าคิดที่{" "}
          {rate.toLocaleString("th-TH")} บาท/AdjRW · ค่าจริงต้องยืนยันด้วย TDRG Seeker หรือหลังลงรหัสใน HOSxP
          {b.reference.tdrg.isDemo && <b> · ค่า RW/WtLOS ในโหมด demo เป็นค่าสมมติ</b>}
          {!b.reference.tdrg.size && <b> · ยังไม่มีตาราง TDRG 6.3 (ใช้ RW เฉลี่ยย้อนหลังแทน)</b>}
        </p>
        <ol>
          {b.refs.map(([t, u]) => (
            <li key={t}>
              {t} — <a href={u} target="_blank" rel="noopener noreferrer">{u}</a>
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
}

type Hit = CodebookEntry;

function ManualAdd({ b, onAdd }: { b: WorkspaceBundle; onAdd: (body: Record<string, unknown>) => Promise<WorkspaceBundle | null> }) {
  const [kind, setKind] = useState<"dx" | "proc">("dx");
  const [dtype, setDtype] = useState(2);
  const [cls, setCls] = useState<"" | "OR" | "NonOR">("");
  const [date, setDate] = useState("");
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<{ q: string; kind: string; list: Hit[] } | null>(null);
  const [msg, setMsg] = useState<{ text: string; code?: string; name?: string | null; warn?: boolean } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const system = kind === "dx" ? "ICD10" : "ICD9CM";

  async function search(text: string, k = kind): Promise<Hit[]> {
    const t = text.trim();
    if (t.length < 2) {
      setHits(null);
      return [];
    }
    const r = await fetchJson<{ matches: Hit[] }>(`/api/codebook?system=${k === "dx" ? "ICD10" : "ICD9CM"}&q=${encodeURIComponent(t)}`);
    setHits({ q: t, kind: k, list: r.matches });
    return r.matches;
  }

  function onInput(v: string) {
    setQ(v);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void search(v), 200);
  }

  async function add(code: string) {
    const nb = await onAdd({
      kind,
      code,
      diagtype: kind === "dx" ? dtype : null,
      orType: kind === "proc" ? cls || null : null,
      opDate: kind === "proc" ? date || null : null,
    });
    if (!nb) return;
    const it = nb.items.find((x) => x.source === "manual" && norm(x.code) === norm(code));
    setMsg(it?.inBook ? { text: "", code: it.code, name: it.name } : { text: "", code: it?.code ?? code, warn: true });
    setQ("");
    setHits(null);
  }

  async function addFromBox() {
    window.clearTimeout(timer.current);
    const t = q.trim();
    if (!t) {
      setMsg({ text: "พิมพ์รหัสหรือชื่อก่อน แล้วกด เพิ่ม" });
      return;
    }
    const list = hits && hits.q === t && hits.kind === kind ? hits.list : await search(t);
    const c = norm(t);
    const exact = list.find((h) => norm(h.code) === c);
    if (exact) return add(exact.code);
    if (list.length) return add(list[0].code);
    if ((kind === "dx" ? /^[A-Z]\d\d[0-9A-Z]{0,3}$/ : /^\d{2,4}$/).test(c)) return add(t);
    setMsg({ text: "ไม่พบรหัส — ลองพิมพ์รหัส (เช่น E87.1, 96.71) หรือชื่อภาษาอังกฤษ" });
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      void addFromBox();
    }
  }

  const list = hits && hits.kind === kind ? hits.list : null;
  return (
    <div className="manual">
      <div className="label">
        เพิ่มรหัสเอง · ICD-10-TM ({b.reference.icd10.size.toLocaleString()} รหัส, ชื่อไทย A–L) · ICD-9-CM FY15 สรท. ({b.reference.icd9.size.toLocaleString()})
      </div>
      <div className="mrow">
        <select
          value={kind}
          onChange={(e) => {
            const k = e.target.value as "dx" | "proc";
            setKind(k);
            void search(q, k);
          }}
          aria-label="ชนิดรหัส"
        >
          <option value="dx">ICD-10-TM</option>
          <option value="proc">ICD-9-CM หัตถการ (OR / Non-OR)</option>
        </select>
        {kind === "dx" && (
          <select value={dtype} onChange={(e) => setDtype(Number(e.target.value))} aria-label="ประเภท">
            <option value={1}>PDx</option>
            <option value={2}>Comorbidity</option>
            <option value={3}>Complication</option>
            <option value={4}>Other</option>
            <option value={5}>External cause</option>
          </select>
        )}
      </div>
      {kind === "proc" && (
        <div className="mrow">
          <select value={cls} onChange={(e) => setCls(e.target.value as typeof cls)} aria-label="ประเภทหัตถการ">
            <option value="">OR/Non-OR อัตโนมัติ</option>
            <option value="OR">OR procedure (ห้องผ่าตัด)</option>
            <option value="NonOR">Non-OR procedure</option>
          </select>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="วันที่ทำหัตถการ" />
        </div>
      )}
      <div className="mrow">
        <input
          type="search"
          value={q}
          onChange={(e) => onInput(e.target.value)}
          onKeyDown={onKey}
          placeholder="รหัสหรือชื่อ เช่น E87.1, ปอดบวม, gastric ulcer, 96.71"
          autoComplete="off"
          aria-label={`ค้นหา ${system}`}
        />
        <button className="btn primary" type="button" style={{ flex: "0 0 auto" }} onClick={() => void addFromBox()}>
          เพิ่ม
        </button>
      </div>
      <div className="hint">พิมพ์รหัสแล้วกด Enter/เพิ่ม ได้ทันที หรือคลิกเลือกจากรายการ (Enter = รายการแรก)</div>
      {list && (
        <div className="mres stagger">
          {list.length ? (
            list.map((x, i) => (
              <button key={x.code} type="button" className={i === 0 ? "first" : ""} style={nth(i)} onClick={() => void add(x.code)}>
                <b className="mono">{x.code}</b> {x.description}
                {x.thai && <span className="muted"> ({x.thai})</span>}
                {x.orType && (
                  <span className={`orp ${orClass(x.orType)}`} title={x.orType === "OR" ? "OR procedure" : x.affectsDrg ? "Non-OR procedure but affects ThaiDRG" : "Non-OR procedure"}>
                    {x.orType === "OR" ? "OR" : x.affectsDrg ? "Non-OR*" : "Non-OR"}
                  </span>
                )}
              </button>
            ))
          ) : (
            <div className="hint">ไม่พบรหัส · ชื่อไทยมีเฉพาะหมวด A–L (ICD-10-TM เล่ม 1ก) · กด เพิ่ม เพื่อใส่รหัสที่พิมพ์ได้เลย</div>
          )}
        </div>
      )}
      {msg && (
        <div className={`mmsg ${msg.code ? "" : "warn"}`}>
          {msg.code ? (
            <>
              ✓ เพิ่ม <b>{msg.code}</b> {msg.name ?? ""} แล้ว
              {msg.warn && <span className="warn"> — ไม่พบในตารางรหัสอ้างอิง โปรดตรวจรหัสอีกครั้ง</span>}
            </>
          ) : (
            msg.text
          )}
        </div>
      )}
    </div>
  );
}
