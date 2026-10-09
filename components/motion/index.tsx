// components/motion — การเคลื่อนไหวของ "กระดาษดิจิทัล" (.impeccable.md)
// CountUp (ตัวเลขหัวหน้า), Odometer (RW หมุนแบบมิเตอร์), BlurText (หมึกซึม), viewTransition (พลิกหน้า / รหัสลอยไปลงตาราง)
// เขียนเองด้วย CSS + requestAnimationFrame + View Transitions API ไม่เพิ่ม dependency · เคารพ prefers-reduced-motion
"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { flushSync } from "react-dom";

export function reducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/**
 * เปลี่ยน state ภายใน View Transition (ถ้า browser รองรับ) — ใช้ flushSync ให้ DOM ใหม่พร้อมตอนถ่ายภาพ
 * ไม่รองรับ / ลดการเคลื่อนไหว → เปลี่ยนทันที
 */
export function viewTransition(update: () => void): void {
  const doc = typeof document !== "undefined" ? (document as Document & { startViewTransition?: (cb: () => void) => unknown }) : null;
  if (!doc?.startViewTransition || reducedMotion()) {
    update();
    return;
  }
  doc.startViewTransition(() => flushSync(update));
}

/** ชื่อ view-transition จาก key รหัส เช่น "dx|E876" → "code-dx-E876" */
export const codeVt = (key: string) => `code-${key.replace(/[^A-Za-z0-9-]/g, "-")}`;

/** ตัวเลขนับขึ้น/ลงจากค่าเดิมไปค่าใหม่ */
export function CountUp({ value, format = (n) => String(Math.round(n)), duration = 700 }: { value: number; format?: (n: number) => string; duration?: number }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = from.current;
    if (start === value || reducedMotion()) {
      from.current = value;
      const id = requestAnimationFrame(() => setShown(value));
      return () => cancelAnimationFrame(id);
    }
    const t0 = performance.now();
    let id = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const e = 1 - Math.pow(1 - p, 4);
      setShown(start + (value - start) * e);
      if (p < 1) id = requestAnimationFrame(tick);
      else from.current = value;
    };
    id = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(id);
      from.current = value;
    };
  }, [value, duration]);
  return <>{format(shown)}</>;
}

const DIGITS = "0123456789";

/** ตัวเลขหมุนแบบมิเตอร์: แต่ละหลักเป็นแถบ 0–9 เลื่อนขึ้นลง (อักขระอื่นแสดงตรงๆ) */
export function Odometer({ text, className = "" }: { text: string; className?: string }) {
  return (
    <span className={`odo ${className}`} aria-label={text}>
      {[...text].map((ch, i) => {
        const d = DIGITS.indexOf(ch);
        if (d < 0) return <span key={`${i}-${ch}`} aria-hidden>{ch}</span>;
        return (
          <span key={i} className="odo-d" aria-hidden>
            <span style={{ transform: `translateY(-${d * 1.2}em)` }}>
              {[...DIGITS].map((x) => <i key={x}>{x}</i>)}
            </span>
          </span>
        );
      })}
    </span>
  );
}

const segmenter = typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter("th", { granularity: "word" }) : null;

/** ข้อความค่อยๆ ซึมขึ้นทีละคำเหมือนหมึก (ตัดคำภาษาไทยด้วย Intl.Segmenter ไม่ตัดกลางสระ/วรรณยุกต์) */
export function BlurText({ text, className }: { text: string; className?: string }) {
  const words = segmenter ? [...segmenter.segment(text)].map((s) => s.segment) : text.split(/(\s+)/);
  return (
    <span className={className} aria-label={text}>
      {words.map((w, i) => (
        <span key={i} aria-hidden className="blur-word" style={{ "--i": i } as CSSProperties}>
          {w}
        </span>
      ))}
    </span>
  );
}

/** style สำหรับลำดับใน .stagger */
export const nth = (i: number) => ({ "--i": i }) as CSSProperties;
