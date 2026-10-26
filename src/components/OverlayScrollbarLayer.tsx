import * as React from "react";

/**
 * แถบเลื่อน (Scrollbar) แบบวาดเองที่ทำงานได้บน iPhone/iPad
 * เพราะ iOS ไม่อนุญาตให้ CSS บังคับแสดงแถบเลื่อนเดิมของระบบบนหน้าจอสัมผัส
 *
 * ครอบคลุม: ทั้งหน้าจอ (page scroll), กล่องรายการ, ป๊อปอัป/หน้าต่าง และกล่องที่เลื่อนได้
 * ยกเว้นรายการในตารางแพลนเนอร์ (กล่องที่ใช้ scrollbar-none หรืออยู่ใน [data-no-osb])
 */

const TRACK_SELECTOR =
  ".force-scrollbar, .dropdown-scroll, .overflow-y-auto, .overflow-auto, .overflow-y-scroll, [role='dialog'], [role='listbox'], [data-radix-scroll-area-viewport]";
const MIN_THUMB_HEIGHT = 28;
const EDGE_PAD = 5;

function isExcluded(el: HTMLElement) {
  if (el.classList.contains("scrollbar-none")) return true;
  if (el.closest("[data-no-osb]")) return true;
  const oy = getComputedStyle(el).overflowY;
  if (oy !== "auto" && oy !== "scroll") return true;
  return false;
}

export function OverlayScrollbarLayer() {
  React.useEffect(() => {
    const thumbs = new Map<HTMLElement, HTMLDivElement>();
    let pageThumb: HTMLDivElement | null = null;
    let raf = 0;
    let frame = 0;
    let tracked: HTMLElement[] = [];

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

    const updatePage = () => {
      const doc = document.documentElement;
      const viewH = window.innerHeight;
      const total = Math.max(doc.scrollHeight, document.body.scrollHeight);
      const overflow = total - viewH;
      if (!pageThumb) {
        pageThumb = document.createElement("div");
        pageThumb.className = "osb-thumb osb-page";
        pageThumb.setAttribute("aria-hidden", "true");
        document.body.appendChild(pageThumb);
      }
      // ซ่อนแถบทั้งหน้าเมื่อมีหน้าต่างป๊อปอัปเปิดอยู่ (หน้าถูกล็อก)
      const locked = document.body.hasAttribute("data-scroll-locked");
      if (overflow <= 4 || locked) {
        pageThumb.style.display = "none";
        return;
      }
      const track = viewH - EDGE_PAD * 2;
      const h = Math.max(MIN_THUMB_HEIGHT * 1.5, Math.round((viewH / total) * track));
      const ratio = Math.min(1, Math.max(0, window.scrollY / overflow));
      pageThumb.style.display = "";
      pageThumb.style.height = `${h}px`;
      pageThumb.style.left = `${window.innerWidth - 8}px`;
      pageThumb.style.top = `${Math.round(EDGE_PAD + (track - h) * ratio)}px`;
    };

    const update = () => {
      // สแกนหากล่องใหม่ทุก ~10 เฟรม เพื่อไม่ให้หนักเครื่อง
      if (frame++ % 10 === 0) {
        tracked = Array.from(document.querySelectorAll<HTMLElement>(TRACK_SELECTOR)).filter(
          (el) => !isExcluded(el),
        );
        for (const [el, thumb] of thumbs) {
          if (!el.isConnected || !tracked.includes(el)) {
            thumb.remove();
            thumbs.delete(el);
          }
        }
      }

      for (const el of tracked) {
        if (!el.isConnected) continue;
        const overflow = el.scrollHeight - el.clientHeight;
        const thumb = ensureThumb(el);
        const rect = el.getBoundingClientRect();
        if (overflow <= 4 || rect.height < 40 || rect.width === 0) {
          if (thumb.style.display !== "none") thumb.style.display = "none";
          continue;
        }
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

      updatePage();
    };

    const loop = () => {
      update();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      thumbs.forEach((thumb) => thumb.remove());
      pageThumb?.remove();
    };
  }, []);

  return null;
}
