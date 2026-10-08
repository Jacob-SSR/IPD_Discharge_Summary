// components/motion — animation เล็กๆ แนว React Bits (CountUp, BlurText, ShinyText, SpotlightCard, ClickSpark)
// เขียนเองด้วย CSS + requestAnimationFrame ไม่เพิ่ม dependency · เคารพ prefers-reduced-motion
"use client";

import { useEffect, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";

function reducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

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
      const e = 1 - Math.pow(1 - p, 3);
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

const segmenter = typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter("th", { granularity: "word" }) : null;

/** ข้อความเบลอแล้วชัดทีละคำ (ตัดคำภาษาไทยด้วย Intl.Segmenter ไม่ตัดกลางสระ/วรรณยุกต์) */
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

export function ShinyText({ children }: { children: ReactNode }) {
  return <span className="shiny">{children}</span>;
}

/** การ์ดที่มีแสงตามตำแหน่งเมาส์ */
export function spotlight(e: MouseEvent<HTMLElement>) {
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
  e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
}

/** ประกายเล็กๆ ตอนกดปุ่ม (ยอมรับรหัส) */
export function sparkAt(el: HTMLElement) {
  if (reducedMotion()) return;
  for (let k = 0; k < 8; k++) {
    const s = document.createElement("i");
    s.className = "spark";
    s.style.setProperty("--a", `${k * 45}deg`);
    el.appendChild(s);
    s.addEventListener("animationend", () => s.remove());
  }
}

/** style สำหรับลำดับใน .stagger */
export const nth = (i: number) => ({ "--i": i }) as CSSProperties;
