// หน้าทำงาน 3 คอลัมน์ (แบบสนามลอง AI ให้รหัสของโปรแกรมเดิม): รายชื่อ | ชาร์ต/แบบฟอร์ม | AI แนะนำรหัส
"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BlurText, CountUp } from "@/components/motion";
import { fetchJson } from "@/lib/client/fetchJson";
import { addDays, todayIso } from "@/lib/date";
import type { ListItem, Tally, WorkspaceBundle } from "@/lib/patients/bundle";
import type { FilterOptions } from "@/lib/patients/types";
import { AiPanel } from "./AiPanel";
import { CenterPane } from "./CenterPane";
import { CommandPalette, type PaletteAction } from "./CommandPalette";
import { PatientList, type ListFilter } from "./PatientList";

const VIEW_KEY = "ipdsum-view";

function filterQuery(f: ListFilter): string {
  const sp = new URLSearchParams();
  sp.set(f.basis === "admit" ? "admitFrom" : "dischargeFrom", f.from);
  sp.set(f.basis === "admit" ? "admitTo" : "dischargeTo", f.to);
  if (f.ward) sp.set("ward", f.ward);
  if (f.doctor) sp.set(f.docRole, f.doctor);
  if (f.q) sp.set("q", f.q);
  return sp.toString();
}

export function Workspace({ mode }: { mode: "demo" | "hosxp" }) {
  const params = useSearchParams();
  const today = todayIso();
  const [filter, setFilter] = useState<ListFilter>({
    basis: "discharge",
    from: addDays(today, -29),
    to: today,
    ward: "",
    docRole: "dischargeDoctor",
    doctor: "",
    q: "",
  });
  const query = filterQuery(filter);

  const [list, setList] = useState<{ query: string; items: ListItem[] } | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [options, setOptions] = useState<FilterOptions>({ wards: [], doctors: [] });
  const [tally, setTally] = useState<Tally | null>(null);
  const [picked, setPicked] = useState<string | null>(params.get("an"));
  const [bundle, setBundle] = useState<WorkspaceBundle | null>(null);
  const [bundleError, setBundleError] = useState<string | null>(null);
  const [view, setViewState] = useState<"chart" | "form">("chart");
  const [busyAn, setBusyAn] = useState<string | null>(null);
  const [aiStatusMsg, setAiStatusMsg] = useState<{ an: string; text: string; err: boolean } | null>(null);
  const ctl = useRef<AbortController | null>(null);
  const [course, setCourseState] = useState<{ an: string; text: string; saved: string } | null>(null);
  const saveTimer = useRef<number | undefined>(undefined);
  const [palette, setPalette] = useState(false);

  // รายชื่อ
  useEffect(() => {
    let off = false;
    fetchJson<{ items: ListItem[] }>(`/api/patients?${query}`)
      .then((r) => {
        if (off) return;
        setList({ query, items: r.items });
        setListError(null);
      })
      .catch((e: Error) => !off && setListError(e.message));
    return () => {
      off = true;
    };
  }, [query]);

  useEffect(() => {
    fetchJson<FilterOptions>("/api/patients/options").then(setOptions, () => undefined);
    try {
      const v = localStorage.getItem(VIEW_KEY);
      if (v === "form" || v === "chart") queueMicrotask(() => setViewState(v));
    } catch {
      /* ไม่มี localStorage ก็ใช้ค่าเริ่มต้น */
    }
  }, []);

  const refreshTally = useCallback(() => {
    fetchJson<Tally>("/api/tally").then(setTally, () => undefined);
  }, []);
  useEffect(refreshTally, [refreshTally]);

  const items = useMemo(() => list?.items ?? [], [list]);
  // ผู้ป่วยที่เลือก: จาก URL/คลิก ถ้าไม่มีใช้รายแรกที่รอสรุป
  const cur = picked ?? items.find((i) => i.pending)?.an ?? items[0]?.an ?? null;

  useEffect(() => {
    if (!cur) return;
    let off = false;
    fetchJson<WorkspaceBundle>(`/api/patients/${cur}`)
      .then((b) => {
        if (off) return;
        setBundle(b);
        setCourseState({ an: b.admission.an, text: b.course?.text ?? "", saved: b.course ? "บันทึกไว้แล้ว" : "" });
        setBundleError(null);
      })
      .catch((e: Error) => !off && setBundleError(e.message));
    return () => {
      off = true;
    };
  }, [cur]);

  function select(an: string) {
    if (busyAn) return;
    setPicked(an);
    const sp = new URLSearchParams(window.location.search);
    sp.set("an", an);
    window.history.replaceState(null, "", `?${sp.toString()}`);
  }

  function setView(v: "chart" | "form") {
    setViewState(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* ไม่บันทึกก็ได้ */
    }
  }

  /** อัปเดตทั้งหน้าหลังตัดสินใจ/วิเคราะห์ (server ส่ง bundle ใหม่กลับมา) */
  const applyBundle = useCallback(
    (b: WorkspaceBundle) => {
      setBundle((old) => (old && old.admission.an !== b.admission.an ? old : b));
      setList((l) =>
        l && {
          ...l,
          items: l.items.map((i) => (i.an === b.admission.an ? { ...i, aiRan: i.aiRan || !!b.run } : i)),
        },
      );
      refreshTally();
    },
    [refreshTally],
  );

  /** สรุปการรักษา: บันทึกอัตโนมัติในฐานข้อมูลของแอป (ไม่ลง HOSxP) */
  function setCourse(text: string, source: "manual" | "ai" = "manual") {
    if (!shown) return;
    const an = shown.admission.an;
    setCourseState({ an, text, saved: "กำลังบันทึก…" });
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      fetchJson("/api/course", { method: "PUT", body: JSON.stringify({ an, text, source }) }).then(
        () => setCourseState((c) => (c && c.an === an ? { ...c, saved: "บันทึกแล้ว" } : c)),
        (e: Error) => setCourseState((c) => (c && c.an === an ? { ...c, saved: `บันทึกไม่สำเร็จ: ${e.message}` } : c)),
      );
    }, 700);
  }

  function insertDraft(draft: string) {
    const cur0 = (courseNow?.text ?? "").trim();
    setCourse(cur0 ? `${cur0}\n${draft}` : draft, "ai");
    setView("chart");
    window.setTimeout(() => {
      const ta = document.getElementById("note");
      ta?.scrollIntoView({ behavior: "smooth", block: "center" });
      ta?.focus({ preventScroll: true });
    }, 60);
  }

  async function analyze() {
    if (!bundle || busyAn) return;
    const an = bundle.admission.an;
    const c = new AbortController();
    ctl.current = c;
    setBusyAn(an);
    setAiStatusMsg(null);
    try {
      const b = await fetchJson<WorkspaceBundle>("/api/ai/analyze", {
        method: "POST",
        body: JSON.stringify({ an }),
        signal: c.signal,
      });
      applyBundle(b);
    } catch (e) {
      const aborted = e instanceof DOMException && e.name === "AbortError";
      setAiStatusMsg({ an, text: aborted ? "หยุดแล้ว" : (e as Error).message || "เรียก AI ไม่สำเร็จ ลองใหม่อีกครั้ง", err: !aborted });
    } finally {
      setBusyAn(null);
      ctl.current = null;
    }
  }

  const shown = bundle && bundle.admission.an === cur ? bundle : null;
  const ordered = useMemo(() => [...items.filter((i) => i.pending), ...items.filter((i) => !i.pending)], [items]);

  // คีย์ลัด: Ctrl/⌘+K = command palette, Alt+↑/↓ = ผู้ป่วยก่อนหน้า/ถัดไป
  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((p) => !p);
      } else if (e.altKey && (e.key === "ArrowDown" || e.key === "ArrowUp") && ordered.length && !busyAn) {
        e.preventDefault();
        const i = ordered.findIndex((x) => x.an === cur);
        const next = ordered[(i + (e.key === "ArrowDown" ? 1 : -1) + ordered.length) % ordered.length];
        setPicked(next.an);
        window.history.replaceState(null, "", `?an=${next.an}`);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ordered, cur, busyAn]);
  const courseNow = course && shown && course.an === shown.admission.an ? course : null;
  const pendingCount = items.filter((i) => i.pending).length;
  const actions: PaletteAction[] = [
    {
      id: "analyze",
      label: shown && !shown.admission.diagnoses.some((d) => d.diagtype === "1") ? "ให้ AI ร่างรหัส" : "วิเคราะห์ด้วย AI",
      hint: shown?.ai.active === "gemini" ? (shown.ai.model ?? "") : "ยังไม่ได้ตั้งค่า AI",
      disabled: !shown || shown.ai.active !== "gemini" || !shown.canDecide || !!busyAn,
      run: () => void analyze(),
    },
    { id: "chart", label: "เปิดแท็บ ข้อมูลในชาร์ต", run: () => setView("chart") },
    { id: "form", label: "เปิดแท็บ แบบฟอร์ม Discharge Summary", run: () => setView("form") },
    {
      id: "print",
      label: "พิมพ์แบบฟอร์ม A4 / บันทึก PDF",
      disabled: !shown,
      run: () => {
        setView("form");
        window.setTimeout(() => window.print(), 300);
      },
    },
    {
      id: "excel",
      label: "ส่งออก Excel",
      disabled: !shown,
      run: () => {
        if (!shown) return;
        const a = document.createElement("a");
        a.href = `/api/patients/${shown.admission.an}/excel`;
        a.click();
      },
    },
    {
      id: "manual",
      label: "เพิ่มรหัสเอง",
      disabled: !shown?.canDecide,
      run: () => document.querySelector<HTMLInputElement>(".manual input[type=search]")?.focus(),
    },
    {
      id: "theme",
      label: "สลับธีม สว่าง / มืด",
      run: () => {
        const el = document.documentElement;
        const dark = el.dataset.theme ? el.dataset.theme === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
        el.dataset.theme = dark ? "light" : "dark";
        try {
          localStorage.setItem("ipdsum-theme", el.dataset.theme);
        } catch {
          /* ไม่จำก็ได้ */
        }
      },
    },
  ];

  return (
    <div className="ws">
      <header className="ws-top">
        <div>
          <h1>
            <span className="grad-text">AI แนะนำรหัส</span> <BlurText text="· สรุปเวชระเบียนผู้ป่วยใน" />
            {mode === "demo" && <span className="demo-tag">ข้อมูลสมมติ</span>}
          </h1>
          <p>
            กลุ่ม “รอสรุป” คือผู้ป่วยที่แพทย์ยังไม่ลงการวินิจฉัยหลักใน HOSxP (บางรายยังนอนอยู่) ให้ AI ร่างรหัสก่อน แพทย์ยืนยันทีละรหัสแล้วค่อยลงใน
            HOSxP เอง · กลุ่ม “ลงรหัสแล้ว” ใช้ให้ AI ตรวจรหัสที่ขาด
            {pendingCount ? ` · รอสรุป ${pendingCount} ราย` : ""}
          </p>
        </div>
        <button type="button" className="kbd no-print" onClick={() => setPalette(true)} title="ค้นหาผู้ป่วยและคำสั่ง">
          ค้นหา / คำสั่ง <kbd>Ctrl</kbd>
          <kbd>K</kbd>
        </button>
        <div className="tally" aria-live="polite" title={tally ? `ปีงบประมาณปัจจุบัน (${tally.from} ถึง ${tally.to})` : undefined}>
          <div>
            <b><CountUp value={tally?.analyzed ?? 0} /></b>
            <span>วิเคราะห์แล้ว</span>
          </div>
          <div>
            <b><CountUp value={tally?.accepted ?? 0} /></b>
            <span>ยอมรับ</span>
          </div>
          <div>
            <b><CountUp value={tally?.rejected ?? 0} /></b>
            <span>ไม่ยอมรับ</span>
          </div>
          <div>
            <b>{tally?.rate != null ? <CountUp value={tally.rate * 100} format={(n) => `${Math.round(n)}%`} /> : "–"}</b>
            <span>อัตรายอมรับ</span>
          </div>
          <div>
            <b>
              <CountUp value={tally?.rwGain ?? 0} format={(n) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}`} />
            </b>
            <span title="รายที่ลงรหัสแล้ว = RW ที่เพิ่ม · รายรอสรุป = RW ทั้งราย">RW จาก AI (ประมาณ)</span>
          </div>
        </div>
      </header>

      <div className="app">
        <PatientList
          items={items}
          loading={!list || list.query !== query}
          error={listError}
          cur={cur}
          busyAn={busyAn}
          onSelect={select}
          filter={filter}
          onFilter={setFilter}
          options={options}
        />
        <CenterPane
          key={cur ?? "none"}
          bundle={shown}
          error={bundleError}
          view={view}
          onView={setView}
          course={courseNow}
          onCourse={setCourse}
          scanning={!!shown && busyAn === shown.admission.an}
        />
        <AiPanel
          key={`ai-${cur ?? "none"}`}
          bundle={shown}
          busy={!!shown && busyAn === shown.admission.an}
          otherBusy={!!busyAn && busyAn !== cur}
          statusMsg={aiStatusMsg && aiStatusMsg.an === cur ? aiStatusMsg : null}
          onAnalyze={analyze}
          onStop={() => ctl.current?.abort()}
          onBundle={applyBundle}
          onUseDraft={insertDraft}
        />
      </div>
      <CommandPalette open={palette} onClose={() => setPalette(false)} items={ordered} actions={actions} onSelect={select} />
    </div>
  );
}
