// คอลัมน์กลาง: แท็บ "ข้อมูลในชาร์ต" / "แบบฟอร์ม Discharge Summary" (A4 พิมพ์/บันทึก PDF, Export Excel)
"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { FileSpreadsheet, Printer } from "lucide-react";
import { acceptedItems } from "@/lib/ai/merge";
import type { MergedItem } from "@/lib/ai/types";
import { finalCodes } from "@/lib/coding/final";
import { codeVt } from "@/components/motion";
import { valOf } from "@/lib/drg/estimate";
import type { WorkspaceBundle } from "@/lib/patients/bundle";
import { clearSheetFit, fitSheetToPage } from "./printFit";
import { baht, DT_TH, n4, orClass, orLabel, sexTh, thd } from "./shared";

type Course = { an: string; text: string; saved: string } | null;

export function CenterPane({
  bundle,
  error,
  view,
  onView,
  course,
  onCourse,
  stale = false,
  stampKey = null,
}: {
  bundle: WorkspaceBundle | null;
  /** แผ่นของผู้ป่วยรายก่อน ระหว่างรอรายใหม่ */
  stale?: boolean;
  /** รหัสที่เพิ่งยืนยัน → ประทับตราในตาราง */
  stampKey?: string | null;
  error: string | null;
  view: "chart" | "form";
  onView: (v: "chart" | "form") => void;
  course: Course;
  onCourse: (text: string) => void;
}) {
  const tabs = useRef<HTMLDivElement>(null);
  const [ink, setInk] = useState<{ left: number; width: number } | null>(null);
  useLayoutEffect(() => {
    const b = tabs.current?.querySelector<HTMLButtonElement>(`button[data-v="${view}"]`);
    if (b) setInk({ left: b.offsetLeft, width: b.offsetWidth });
  }, [view, bundle]);

  if (!bundle) {
    return (
      <main className="pane chart" aria-busy="true">
        {error ? <p className="banner">{error}</p> : (
          <>
            <div className="skeleton" style={{ height: 32, width: "50%" }} />
            <div className="skeleton" style={{ height: 70 }} />
            <div className="skeleton" style={{ height: 160 }} />
          </>
        )}
      </main>
    );
  }
  const acc = acceptedItems(bundle.items, new Map(Object.entries(bundle.state)));

  return (
    <main className="pane chart" aria-live="polite" aria-busy={stale} style={{ opacity: stale ? 0.55 : 1, transition: "opacity .2s" }}>
      {stale && error && <p className="banner">{error}</p>}
      <div className="vtabs" role="tablist" ref={tabs}>
        <button type="button" role="tab" data-v="chart" aria-selected={view === "chart"} onClick={() => onView("chart")}>
          ข้อมูลในชาร์ต
        </button>
        <button type="button" role="tab" data-v="form" aria-selected={view === "form"} onClick={() => onView("form")}>
          แบบฟอร์ม Discharge Summary
        </button>
        {ink && <span className="ink" style={ink} />}
        {view === "form" && (
          <span className="tools">
            <button type="button" className="btn sm" onClick={() => window.print()} title="พิมพ์ / บันทึกเป็น PDF ขนาด A4">
              <Printer size={14} className="inline -mt-0.5" /> พิมพ์ A4
            </button>
            <a className="btn sm" href={`/api/patients/${bundle.admission.an}/excel`} title="ส่งออก Excel">
              <FileSpreadsheet size={14} className="inline -mt-0.5" /> Excel
            </a>
          </span>
        )}
      </div>
      {/* แบบฟอร์ม "พิมพ์ออกมา" จากช่องเครื่องพิมพ์ใต้แท็บ · ชาร์ตค่อยๆ ปรากฏ */}
      <div key={view} className={view === "form" ? "print-out" : "page-in"}>
        {view === "form" ? (
          <FormSheet b={bundle} acc={acc} note={course?.text ?? ""} />
        ) : (
          <ChartView b={bundle} acc={acc} course={course} onCourse={onCourse} stampKey={stampKey} />
        )}
      </div>
    </main>
  );
}

function Screen({ b, form }: { b: WorkspaceBundle; form?: boolean }) {
  const a = b.admission;
  const s = a.screen;
  const v = (x: number | null | undefined) => (x == null ? "-" : x);
  return (
    <>
      <p><b>CC:</b> {s?.cc ?? "-"}</p>
      {a.prediag && (
        <p>
          <b>วินิจฉัยแรกรับ:</b> {a.prediag} {a.admitDx.length > 0 && <span className="muted">(ER/OPD: {a.admitDx.join(", ")})</span>}
        </p>
      )}
      {!a.prediag && a.admitDx.length > 0 && <p><b>รหัสจาก ER/OPD:</b> {a.admitDx.join(", ")}</p>}
      <p><b>HPI:</b> {s?.hpi ?? "-"}</p>
      {form ? (
        <p>
          <b>V/S แรกรับ:</b> BP {v(s?.bps)}/{v(s?.bpd)} mmHg · PR {v(s?.pulse)}/min · RR {v(s?.rr)}/min · T {v(s?.temperature)} °C · BW {v(s?.bw)} kg
        </p>
      ) : (
        <p className="muted">
          V/S แรกรับ: BP {v(s?.bps)}/{v(s?.bpd)} · PR {v(s?.pulse)} · RR {v(s?.rr)} · T {v(s?.temperature)} °C · BW {v(s?.bw)} kg
        </p>
      )}
    </>
  );
}

function Labs({ b, head = true }: { b: WorkspaceBundle; head?: boolean }) {
  if (!b.labs.length) return <p className="muted">ไม่มีผลแลบ</p>;
  return (
    <div className="tbl-wrap">
      <table>
        {head && (
          <thead>
            <tr><th>รายการ</th><th className="num">ครั้งแรก</th><th className="num">ล่าสุด</th><th>ค่าปกติ</th></tr>
          </thead>
        )}
        <tbody>
          {b.labs.map((l) => (
            <tr key={l.item}>
              <td>{l.item}</td>
              <td className={`num ${l.ff ? "fl" : ""}`}>{l.first} {l.ff}</td>
              <td className={`num ${l.last != null && l.lf ? "fl" : ""}`}>{l.last != null ? `${l.last} ${l.lf}` : "–"}</td>
              <td className="muted">{l.normal ?? ""} {l.unit ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Meds({ b }: { b: WorkspaceBundle }) {
  if (!b.meds.length) return <p className="muted">ไม่มีรายการยา</p>;
  return (
    <ul className="meds">
      {b.meds.map((m, i) => (
        <li key={i}>{m.name} {m.strength ?? ""} ×{m.qty ?? "-"}</li>
      ))}
    </ul>
  );
}

function ChartView({
  b,
  acc,
  course,
  onCourse,
  stampKey,
}: {
  b: WorkspaceBundle;
  acc: MergedItem[];
  course: Course;
  onCourse: (t: string) => void;
  stampKey: string | null;
}) {
  const a = b.admission;
  const pending = !a.diagnoses.some((d) => d.diagtype === "1");
  const admitted = a.dischargeDate == null;
  return (
    <div className="stagger">
      {pending && (
        <div className="banner" style={{ ["--i" as string]: 0 }}>
          ยังไม่มีการวินิจฉัยหลักใน HOSxP{admitted ? " · ผู้ป่วยยังนอนโรงพยาบาล" : ""} — กด “ให้ AI ร่างรหัส” แล้วยืนยันทีละรหัส
        </div>
      )}
      <div className="chart-head">
        <h2>
          {a.patientName}{" "}
          <span className="sub">
            {sexTh(a.sex)} {a.ageYears ?? "-"} ปี
          </span>
        </h2>
        <div className="ids">
          <span>AN {a.an}</span>
          <span>HN {a.hn}</span>
        </div>
      </div>
      <div className="facts">
        <div><span>หอผู้ป่วย</span><b>{a.wardName ?? "-"}</b></div>
        <div><span>สิทธิ</span><b>{a.pttypeName ?? "-"}</b></div>
        <div><span>รับไว้ → จำหน่าย</span><b>{thd(a.admitDate)} → {admitted ? "ยังไม่จำหน่าย" : thd(a.dischargeDate)}</b></div>
        <div><span>{admitted ? "นอนมาแล้ว" : "วันนอน"}</span><b>{a.los ?? "-"} วัน</b></div>
        <div><span>การจำหน่าย</span><b>{admitted ? "-" : `${a.dischargeStatus?.name ?? "-"} / ${a.dischargeType?.name ?? "-"}`}</b></div>
        <div><span>DRG · AdjRW</span><b>{a.drg ?? "-"} · {n4(a.adjrw)}</b></div>
        <div><span>แพทย์ผู้จำหน่าย</span><b>{a.dischargeDoctor?.name ?? "-"}</b></div>
      </div>
      {!pending && b.alerts.length > 0 && (
        <ul className="alerts">
          {b.alerts.map((x, i) => (
            <li key={i} className={x.level}>{x.message}</li>
          ))}
        </ul>
      )}
      <div className="sec">
        <h3>อาการสำคัญและประวัติ</h3>
        <Screen b={b} />
      </div>
      <div className="sec">
        <h3>รหัสที่ลงไว้ใน HOSxP</h3>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>ประเภท</th><th>รหัส</th><th>ชื่อ</th></tr></thead>
            <tbody>
              {a.diagnoses.length ? (
                a.diagnoses.map((d, i) => (
                  <tr key={i} className={d.diagtype === "1" ? "pdx" : ""}>
                    <td>{DT_TH[Number(d.diagtype)]}</td>
                    <td className="code">{d.icd10}</td>
                    <td>{d.name}</td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={3} className="muted">ยังไม่ลงการวินิจฉัย</td></tr>
              )}
              {a.procedures.map((x, i) => (
                <tr key={`p${i}`}>
                  <td>หัตถการ <span className={`orp ${orClass(x.orType)}`}>{orLabel(x.orType)}</span></td>
                  <td className="code">{x.icd9}{x.ext ? <span className="muted"> ext {x.ext}</span> : null}</td>
                  <td>{x.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {acc.length > 0 && (
          <>
            <div className="acc-title">รหัสที่แพทย์ยืนยัน (จาก AI / เพิ่มเอง) · รอบันทึกใน HOSxP</div>
            <div className="tbl-wrap">
              <table>
                <tbody className="stagger">
                  {acc.map((s, i) => (
                    <tr key={s.key} className={`acc ${s.key === stampKey ? "stamped" : ""}`} style={{ ["--i" as string]: i }}>
                      <td>
                        {s.kind === "dx" ? DT_TH[s.diagtype ?? 0] : (
                          <>หัตถการ <span className={`orp ${orClass(s.procClass)}`}>{orLabel(s.procClass)}</span>{s.procDate ? ` ${thd(s.procDate)}` : ""}</>
                        )}
                      </td>
                      <td className="code">
                        {/* รหัสที่เพิ่งยืนยัน: ชื่อเดียวกับรหัสบนการ์ด → รหัสลอยจากการ์ดมาลงแถวนี้ (View Transition) */}
                        <span style={s.key === stampKey ? { viewTransitionName: codeVt(s.key), display: "inline-block" } : undefined}>{s.code}</span>
                      </td>
                      <td>
                        {s.name}
                        <span className="stamp-mark">{s.source === "manual" ? "แพทย์เพิ่ม" : "ยืนยันแล้ว"}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
      <div className="sec">
        <h3>ผลแลบ (ครั้งแรก → ล่าสุด)</h3>
        <Labs b={b} />
      </div>
      <div className="sec">
        <h3>ยาและเวชภัณฑ์ที่ได้รับ</h3>
        <Meds b={b} />
      </div>
      <div className="sec">
        <h3>สรุปการรักษา (Course in hospital)</h3>
        <textarea
          id="note"
          className="note"
          value={course?.text ?? ""}
          onChange={(e) => onCourse(e.target.value)}
          readOnly={!b.canDecide}
          placeholder={b.canDecide ? "พิมพ์สรุปการรักษา หรือกด “ใส่ในช่องสรุปการรักษา” จากร่างของ AI แล้วแก้ไข" : "บัญชีนี้ดูได้อย่างเดียว"}
        />
        <div className="hint">
          {course?.saved ? `${course.saved} · ` : ""}บันทึกอัตโนมัติในฐานข้อมูลของโปรแกรม (ไม่บันทึกลง HOSxP) · ข้อความที่พิมพ์เองไม่ถูกส่งให้ AI
          จนกว่าจะมีระบบตัดข้อมูลระบุตัวตนในข้อความอิสระที่ผ่านการตรวจ
        </div>
      </div>
    </div>
  );
}

function FormSheet({ b, acc, note }: { b: WorkspaceBundle; acc: MergedItem[]; note: string }) {
  const a = b.admission;
  const pending = !a.diagnoses.some((d) => d.diagtype === "1");
  const admitted = a.dischargeDate == null;
  const { dx, px } = finalCodes(a, acc);
  const est = b.rw.after ?? b.rw.before;
  const real = a.rw != null && !acc.length;
  const tag = (o: string) => (o === "hosxp" ? null : <span className={`ftag ${o === "manual" ? "man" : ""}`}>{o === "manual" ? "แพทย์เพิ่ม" : "ยืนยันจาก AI"}</span>);
  const draft = pending || acc.length > 0;
  // พิมพ์ (ปุ่ม/Ctrl+P/คำสั่ง) → ย่อให้จบ A4 หน้าเดียว แล้วคืนค่าหลังพิมพ์
  const sheet = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const before = () => { if (sheet.current) fitSheetToPage(sheet.current); };
    const after = () => { if (sheet.current) clearSheetFit(sheet.current); };
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
    };
  }, []);
  return (
    <div className="sheet" ref={sheet}>
      {draft && (
        <div className="fdraft">
          ร่างแบบสรุป — {pending ? "ยังไม่มีการวินิจฉัยหลักใน HOSxP · " : ""}รหัสที่มีป้ายสีต้องลงใน HOSxP โดยแพทย์/ผู้ให้รหัส
        </div>
      )}
      <div className="fhead">
        <div>
          <div className="hosp">
            {b.hospital.name} <small>จังหวัด{b.hospital.province} · รหัสสถานพยาบาล {b.hospital.code}</small>
          </div>
          <h2>แบบสรุปการรักษาผู้ป่วยใน <span>Discharge Summary</span></h2>
        </div>
        <div className="fids">
          <div><span>AN</span><b>{a.an}</b></div>
          <div><span>HN</span><b>{a.hn}</b></div>
        </div>
      </div>
      <div className="finfo">
        <div className="w2"><span>ชื่อ-สกุล</span><b>{a.patientName}</b></div>
        <div><span>เพศ / อายุ</span><b>{sexTh(a.sex)} / {a.ageYears ?? "-"} ปี</b></div>
        <div><span>สิทธิการรักษา</span><b>{a.pttypeName ?? "-"}</b></div>
        <div><span>หอผู้ป่วย</span><b>{a.wardName ?? "-"}</b></div>
        <div><span>วันที่รับไว้</span><b>{thd(a.admitDate)}</b></div>
        <div><span>วันที่จำหน่าย</span><b>{admitted ? "ยังไม่จำหน่าย" : thd(a.dischargeDate)}</b></div>
        <div><span>{admitted ? "นอนมาแล้ว" : "วันนอน (LOS)"}</span><b>{a.los ?? "-"} วัน</b></div>
        <div><span>สถานะการจำหน่าย</span><b>{admitted ? "-" : (a.dischargeStatus?.name ?? "-")}</b></div>
        <div><span>ประเภทการจำหน่าย</span><b>{admitted ? "-" : (a.dischargeType?.name ?? "-")}</b></div>
        <div className="w2">
          <span>DRG / RW / AdjRW {real ? "(HOSxP)" : est ? "(ประมาณ)" : ""}</span>
          <b>{real ? `${a.drg ?? "-"} / ${n4(a.rw)} / ${n4(a.adjrw)}` : est ? `${est.drg} / ${n4(est.rw)} / ${n4(est.adjrw)}` : "-"}</b>
        </div>
      </div>
      <div className="fsec">
        <h3>อาการสำคัญและประวัติ</h3>
        <Screen b={b} form />
      </div>
      <div className="fsec">
        <h3>การวินิจฉัยโรค (ICD-10-TM)</h3>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th style={{ width: "26%" }}>ประเภท</th><th style={{ width: "12%" }}>รหัส</th><th>ชื่อโรค</th></tr></thead>
            <tbody>
              {dx.length ? (
                dx.map((r, i) => (
                  <tr key={i} className={`${r.diagtype === "1" && !r.replaced ? "pdx" : ""} ${r.replaced ? "strike" : ""}`}>
                    <td>{DT_TH[Number(r.diagtype)] ?? ""}{r.replaced && <small> (เสนอเปลี่ยน)</small>}</td>
                    <td className="code">{r.code}</td>
                    <td>{r.name} {tag(r.origin)}</td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={3} className="muted">— ยังไม่มีการวินิจฉัย —</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="fsec">
        <h3>หัตถการ / การผ่าตัด (ICD-9-CM) <small>OR / Non-OR procedure</small></h3>
        {px.length ? (
          <div className="tbl-wrap">
            <table>
              <thead><tr><th style={{ width: "14%" }}>ประเภท</th><th style={{ width: "12%" }}>รหัส</th><th>ชื่อหัตถการ</th><th style={{ width: "18%" }}>วันที่</th></tr></thead>
              <tbody>
                {px.map((r, i) => (
                  <tr key={i}>
                    <td><span className={`orp ${orClass(r.orType)}`}>{orLabel(r.orType)}</span></td>
                    <td className="code">{r.code}{r.ext ? <small className="muted"> ext {r.ext}</small> : null}</td>
                    <td>{r.name} {tag(r.origin)}</td>
                    <td>{r.opDate ? thd(r.opDate) : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">ไม่มี</p>
        )}
      </div>
      <div className="fsec">
        <h3>สรุปการรักษาในโรงพยาบาล (Course in hospital)</h3>
        {note.trim() ? (
          <p className="pre">{note.trim()}</p>
        ) : (
          <>
            <div className="lines" />
            <p className="hint">ยังว่าง — พิมพ์ได้ในแท็บ “ข้อมูลในชาร์ต” หรือกด “ใส่ในช่องสรุปการรักษา” จากร่างของ AI</p>
          </>
        )}
      </div>
      <div className="fsec">
        <h3>ผลตรวจทางห้องปฏิบัติการ <small>(ครั้งแรก → ล่าสุด)</small></h3>
        <Labs b={b} head={false} />
      </div>
      <div className="fsec">
        <h3>ยาที่ได้รับระหว่างนอนโรงพยาบาล</h3>
        <Meds b={b} />
      </div>
      <div className="fsec">
        <h3>สภาพผู้ป่วยขณะจำหน่าย / คำแนะนำ / นัดติดตาม</h3>
        <div className="lines" />
      </div>
      <div className="fsign">
        <div className="muted">
          {real || !est ? "" : `RW ประมาณจากรหัสในแบบฟอร์ม ${n4(valOf(est))} · ≈ ${baht(valOf(est) ?? 0, b.baseRate)} บาท`}
        </div>
        <div className="sig">
          <div className="sl" />
          <div>( .............................................. )</div>
          <div className="muted">แพทย์ผู้รักษา</div>
        </div>
      </div>
      <div className="fnote">พิมพ์/บันทึกเป็น PDF ขนาด A4 จากปุ่ม “พิมพ์ A4” · รหัสที่มีป้ายสียังไม่ได้บันทึกใน HOSxP</div>
    </div>
  );
}
