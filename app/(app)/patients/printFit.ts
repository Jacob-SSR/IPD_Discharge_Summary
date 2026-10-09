// พิมพ์แบบฟอร์ม Discharge Summary ให้จบใน A4 หน้าเดียว:
// ก่อนพิมพ์ ใส่ตัวอักษรแบบกระชับ (.sheet.compact) แล้ววัดความสูงที่ความกว้างหน้ากระดาษจริง
// ถ้ายังเกินหนึ่งหน้า ค่อยย่อทั้งแผ่นด้วย zoom (--fit) — ไม่ต่ำกว่า MIN_FIT ถ้าต้องย่อมากกว่านั้นให้ขึ้นหน้าสอง

const MM = 96 / 25.4;
/** A4 210×297 มม. ลบขอบ 10 มม. ทั้งสองด้าน (padding ของ body ตอนพิมพ์ ใน globals.css) */
const PAGE_W = 190 * MM;
const PAGE_H = 277 * MM * 0.985; // เผื่อปัดเศษของเบราว์เซอร์
/** ย่อได้ต่ำสุดเท่านี้ (≈ 10.6px / 8pt) — ผู้ใช้ไม่เอาแบบบีบเกินไป: ยาวกว่านั้นให้ขึ้นหน้าสองแทน */
export const MIN_FIT = 0.85;

export function fitSheetToPage(el: HTMLElement): number {
  el.classList.add("compact", "measure");
  el.style.removeProperty("--fit");
  // zoom z ทำให้บรรทัดกว้างขึ้นเป็น PAGE_W / z (ข้อความตัดบรรทัดน้อยลง) — วัดที่ความกว้างนั้นโดยไม่ zoom
  const heightAt = (z: number) => {
    el.style.width = `${PAGE_W / z}px`;
    return el.offsetHeight * z;
  };
  let fit = 1;
  if (heightAt(1) > PAGE_H) {
    let lo = MIN_FIT;
    let hi = 1;
    for (let i = 0; i < 7; i++) {
      const mid = (lo + hi) / 2;
      if (heightAt(mid) <= PAGE_H) lo = mid;
      else hi = mid;
    }
    fit = lo;
  }
  el.style.removeProperty("width");
  el.classList.remove("measure");
  if (fit < 1) el.style.setProperty("--fit", fit.toFixed(3));
  return fit;
}

export function clearSheetFit(el: HTMLElement) {
  el.classList.remove("compact", "measure");
  el.style.removeProperty("--fit");
  el.style.removeProperty("width");
}
