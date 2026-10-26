import * as React from "react";

/**
 * แถบเลื่อน (Scrollbar) แบบวาดเองที่ทำงานได้ 100% บน iPhone/iPad
 * เพราะ iOS ไม่อนุญาตให้ CSS บังคับแสดงแถบเลื่อนเดิมของระบบบนหน้าจอสัมผัส
 *
 * ทำงานโดยหากล่องที่เลื่อนได้ทุกกล่อง (คลาส force-scrollbar / dropdown-scroll)
 * แล้ววาดแถบบาง ๆ ลอยอยู่ข้างกล่อง แสดงตลอดเมื่อรายการเกินความสูง
 * และเลื่อนตามตำแหน่งจริงแบบเรียลไทม์
 */

const TRACK_SELECTOR = ".force-scrollbar, .dropdown-scroll";
const MIN_THUMB_HEIGHT = 28;
const EDGE_PAD = 5;

export function OverlayScrollbarLayer() {
  React.useEffect(() => {
    const thumbs = new Map<HTMLElement, HTMLDivElement>();
    let raf = 0;

    const ensureThumb = (el: HTMLElement): HTMLDivElement => {
      let thumb = thumbs.get(el);
      if (!thumb) {
        thumb = document.createElement("div");
        thumb.className = "osb-thumb";
        thumb.setAttribute("aria-hidden", "true");
        document.body.appendChild(thumb);
        thumbs.set(el, thumb);
      }
      return thumb;
    };

    const update = () => {
      for (const el of document.querySelectorAll<HTMLElement>(TRACK_SELECTOR)) {
        if (!el.isConnected) continue;
        const overflow = el.scrollHeight - el.clientHeight;
        const thumb = ensureThumb(el);
        if (overflow <= 4) {
          // ไม่มีรายการเกิน — ไม่ต้องแสดงแถบ
          if (thumb.style.display !== "none") thumb.style.display = "none";
          continue;
        }
        const rect = el.getBoundingClientRect();
        const trackHeight = Math.max(0, el.clientHeight - EDGE_PAD * 2);
        const thumbHeight = Math.max(
          MIN_THUMB_HEIGHT,
          Math.round((el.clientHeight / el.scrollHeight) * trackHeight),
        );
        const maxThumbTop = Math.max(0, trackHeight - thumbHeight);
        const ratio = Math.min(1, Math.max(0, el.scrollTop / overflow));
        const top = rect.top + EDGE_PAD + Math.round(maxThumbTop * ratio);

        thumb.style.display = "";
        thumb.style.height = `${thumbHeight}px`;
        thumb.style.left = `${Math.round(rect.right - 9)}px`;
        thumb.style.top = `${Math.round(top)}px`;
      }

      // ลบแถบของกล่องที่ถูกปิด/ถอดออกจากหน้าจอแล้ว
      for (const [el, thumb] of thumbs) {
        if (!el.isConnected) {
          thumb.remove();
          thumbs.delete(el);
        }
      }
    };

    const loop = () => {
      update();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      thumbs.forEach((thumb) => thumb.remove());
    };
  }, []);

  return null;
}
