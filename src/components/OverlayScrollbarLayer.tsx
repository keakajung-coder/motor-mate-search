import * as React from "react";

/**
 * แถบเลื่อน (Scrollbar) แบบวาดเองที่ทำงานได้บน iPhone/iPad
 * เพราะ iOS ไม่อนุญาตให้ CSS บังคับแสดงแถบเลื่อนเดิมของระบบบนหน้าจอสัมผัส
 *
 * ครอบคลุม: ทั้งหน้าจอ (page scroll), กล่องรายการ, ป๊อปอัป/หน้าต่าง และกล่องที่เลื่อนได้
 * ยกเว้นรายการในตารางแพลนเนอร์ (กล่องที่ใช้ scrollbar-none หรืออยู่ใน [data-no-osb])
 *
 * กล่องเลือกบางชนิด (เช่น cmdk Combobox) มี 2 ชั้น:
 * ชั้นนอกเป็นกรอบ ส่วนชั้นใน ([cmdk-list-sizer] หรือลูกที่ overflow) เป็นตัวเลื่อนจริง
 * จึงไต่ลงไปหาชั้นในสุดที่เลื่อนได้จริงก่อนวาดแถบเสมอ
 *
 * สำคัญ: แท่งเลื่อนและ Track ต้องฝังที่ document.body เท่านั้น
 * เพราะกรอบป๊อปอัปของ Radix มี transform (สร้าง containing block ใหม่)
 * ทำให้ position:fixed ที่อยู่ข้างในคำนวณพิกัดผิดจาก viewport
 * (การแตะที่แท่งไม่ปิดกล่อง เพราะ stopPropagation ตัด event ก่อนถึงตัวฟังของ Radix)
 */
const TRACK_SELECTOR =
  ".force-scrollbar, .dropdown-scroll, .overflow-y-auto, .overflow-auto, .overflow-y-scroll, [role='dialog'], [role='listbox'], [data-radix-scroll-area-viewport], [cmdk-list], [cmdk-list-sizer]";
const MIN_THUMB_HEIGHT = 28;
const EDGE_PAD = 5;

function isExcluded(el: HTMLElement) {
  if (el.classList.contains("scrollbar-none")) return true;
  if (el.closest("[data-no-osb]")) return true;
  const oy = getComputedStyle(el).overflowY;
  if (oy !== "auto" && oy !== "scroll") return true;
  return false;
}

function findInnerScroller(root: HTMLElement): HTMLElement | null {
  // หาลูกชั้นในสุดที่เลื่อนได้จริง (มีเนื้อหายาวเกินกรอบ)
  const all = root.getElementsByTagName("*");
  for (let i = 0; i < all.length; i++) {
    const n = all[i] as HTMLElement;
    const oy = getComputedStyle(n).overflowY;
    if ((oy === "auto" || oy === "scroll") && n.scrollHeight - n.clientHeight > 4) {
      return n;
    }
  }
  return null;
}

export function OverlayScrollbarLayer() {
  React.useEffect(() => {
    const thumbs = new Map<HTMLElement, HTMLDivElement>();
    const tracks = new Map<HTMLElement, HTMLDivElement>();
    let pageThumb: HTMLDivElement | null = null;
    let pageTrack: HTMLDivElement | null = null;
    let raf = 0;
    let frame = 0;
    let scrollers: HTMLElement[] = [];

    // คำนวณตัวคูณระหว่างระยะนิ้วบนแถบกับระยะเนื้อหาที่เลื่อนจริง
    const dragFactor = (el: HTMLElement | null, thumbH: number) => {
      const viewH = el ? el.clientHeight : window.innerHeight;
      const total = el
        ? el.scrollHeight
        : Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
      const trackH = viewH - EDGE_PAD * 2;
      return (total - viewH) / Math.max(1, trackH - thumbH);
    };

    // ตั้งค่าการลาก: แตะค้างที่แท่งแล้วรูดขึ้น–ลง เนื้อหาเลื่อนตามทันที
    const bindDrag = (thumb: HTMLDivElement, el: HTMLElement | null) => {
      const setScroll = (v: number) => {
        if (el) el.scrollTop = v;
        else window.scrollTo(0, v);
      };
      const getScroll = () => (el ? el.scrollTop : window.scrollY);

      // แนวทางหลัก: Pointer Events (เดสก์ท็อป + iOS/iPadOS 13+)
      let pointerActive = false;
      thumb.addEventListener("pointerdown", (e) => {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        pointerActive = true;
        thumb.classList.add("osb-dragging");
        try {
          thumb.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        const startY = e.clientY;
        const startScroll = getScroll();
        const factor = dragFactor(el, thumb.offsetHeight);
        const move = (ev: PointerEvent) => {
          ev.preventDefault();
          setScroll(startScroll + (ev.clientY - startY) * factor);
        };
        const end = () => {
          pointerActive = false;
          thumb.classList.remove("osb-dragging");
          thumb.removeEventListener("pointermove", move);
          thumb.removeEventListener("pointerup", end);
          thumb.removeEventListener("pointercancel", end);
          thumb.removeEventListener("lostpointercapture", end);
        };
        thumb.addEventListener("pointermove", move);
        thumb.addEventListener("pointerup", end);
        thumb.addEventListener("pointercancel", end);
        thumb.addEventListener("lostpointercapture", end);
      });

      // แนวทางสำรอง: Touch Events สำหรับ iOS ที่ pointer events ถูกยกเลิกกลางทาง
      thumb.addEventListener(
        "touchstart",
        (e) => {
          e.preventDefault(); // ปิดการเลื่อนของระบบ ไม่ให้ชนกับการลาก
          e.stopPropagation();
          if (pointerActive) return;
          const t = e.touches[0];
          if (!t) return;
          thumb.classList.add("osb-dragging");
          const startY = t.clientY;
          const startScroll = getScroll();
          const factor = dragFactor(el, thumb.offsetHeight);
          const move = (ev: TouchEvent) => {
            ev.preventDefault();
            const cur = ev.touches[0];
            if (!cur) return;
            setScroll(startScroll + (cur.clientY - startY) * factor);
          };
          const end = () => {
            thumb.classList.remove("osb-dragging");
            thumb.removeEventListener("touchmove", move);
            thumb.removeEventListener("touchend", end);
            thumb.removeEventListener("touchcancel", end);
          };
          thumb.addEventListener("touchmove", move, { passive: false });
          thumb.addEventListener("touchend", end);
          thumb.addEventListener("touchcancel", end);
        },
        { passive: false },
      );

      // กันไม่ให้การแตะทะลุไปปิดกล่องตัวเลือก (เสริมจาก stopPropagation ในตัวจับลากข้างบน)
      thumb.addEventListener("mousedown", (e) => e.stopPropagation());
    };

    // แตะที่แถบ Track (แถบจางด้านหลัง) เพื่อกระโดดไปตำแหน่งนั้นทันที
    const bindTrack = (track: HTMLDivElement, el: HTMLElement | null) => {
      track.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const rect = track.getBoundingClientRect();
        const thumbH = MIN_THUMB_HEIGHT;
        const usable = Math.max(1, rect.height - thumbH);
        const ratio = Math.min(1, Math.max(0, (e.clientY - rect.top) / usable));
        if (el) {
          el.scrollTop = ratio * (el.scrollHeight - el.clientHeight);
        } else {
          const total = Math.max(
            document.documentElement.scrollHeight,
            document.body.scrollHeight,
          );
          window.scrollTo(0, ratio * (total - window.innerHeight));
        }
      });
      track.addEventListener("mousedown", (e) => e.stopPropagation());
      track.addEventListener("touchstart", (e) => e.stopPropagation(), { passive: true });
    };

    const ensureParts = (el: HTMLElement): { thumb: HTMLDivElement; track: HTMLDivElement } => {
      let thumb = thumbs.get(el);
      let track = tracks.get(el);
      if (!thumb) {
        thumb = document.createElement("div");
        thumb.className = "osb-thumb";
        thumb.setAttribute("aria-hidden", "true");
        bindDrag(thumb, el);
        // ฝังที่ body เท่านั้น — พิกัด fixed ตรงกับ viewport และไม่โดน transform ของป๊อปอัป
        document.body.appendChild(thumb);
        thumbs.set(el, thumb);
      }
      if (!track) {
        track = document.createElement("div");
        track.className = "osb-track";
        track.setAttribute("aria-hidden", "true");
        bindTrack(track, el);
        document.body.appendChild(track);
        tracks.set(el, track);
      }
      return { thumb, track };
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
        bindDrag(pageThumb, null);
        document.body.appendChild(pageThumb);
      }
      if (!pageTrack) {
        pageTrack = document.createElement("div");
        pageTrack.className = "osb-track osb-page-track";
        pageTrack.setAttribute("aria-hidden", "true");
        bindTrack(pageTrack, null);
        document.body.appendChild(pageTrack);
      }
      // ซ่อนแถบทั้งหน้าเมื่อมีหน้าต่างป๊อปอัปเปิดอยู่ (หน้าถูกล็อก)
      const locked = document.body.hasAttribute("data-scroll-locked");
      if (overflow <= 4 || locked) {
        pageThumb.style.display = "none";
        pageTrack.style.display = "none";
        return;
      }
      const track = viewH - EDGE_PAD * 2;
      const h = Math.max(MIN_THUMB_HEIGHT * 1.5, Math.round((viewH / total) * track));
      const ratio = Math.min(1, Math.max(0, window.scrollY / overflow));
      pageThumb.style.display = "";
      pageThumb.style.height = `${h}px`;
      pageThumb.style.left = `${window.innerWidth - 8}px`;
      pageThumb.style.top = `${Math.round(EDGE_PAD + (track - h) * ratio)}px`;
      pageTrack.style.display = "";
      pageTrack.style.height = `${track}px`;
      pageTrack.style.left = `${window.innerWidth - 8}px`;
      pageTrack.style.top = `${EDGE_PAD}px`;
    };

    const update = () => {
      // สแกนหากล่องใหม่ทุก ~10 เฟรม เพื่อไม่ให้หนักเครื่อง
      if (frame++ % 10 === 0) {
        const matched = Array.from(document.querySelectorAll<HTMLElement>(TRACK_SELECTOR)).filter(
          (el) => !isExcluded(el),
        );
        const next: HTMLElement[] = [];
        const seen = new Set<HTMLElement>();
        for (const el of matched) {
          // ตัวที่เลื่อนจริง: ตัวมันเองถ้ามีเนื้อหาล้น ไม่งั้นไต่หาลูกชั้นในที่เลื่อนได้
          let sc: HTMLElement | null = el;
          if (el.scrollHeight - el.clientHeight <= 4) {
            sc = findInnerScroller(el);
          }
          if (!sc || seen.has(sc)) continue;
          seen.add(sc);
          next.push(sc);
        }
        scrollers = next;
        for (const [el, thumb] of thumbs) {
          if (!el.isConnected || !seen.has(el)) {
            thumb.remove();
            thumbs.delete(el);
          }
        }
        for (const [el, track] of tracks) {
          if (!el.isConnected || !seen.has(el)) {
            track.remove();
            tracks.delete(el);
          }
        }
      }

      for (const el of scrollers) {
        if (!el.isConnected) continue;
        const overflow = el.scrollHeight - el.clientHeight;
        const rect = el.getBoundingClientRect();
        const { thumb, track } = ensureParts(el);
        if (overflow <= 4 || rect.height < 40 || rect.width === 0) {
          if (thumb.style.display !== "none") thumb.style.display = "none";
          if (track.style.display !== "none") track.style.display = "none";
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

        // แถบ Track จาง ๆ ด้านหลัง ให้เห็นทันทีว่ากล่องนี้เลื่อนได้
        if (trackHeight > thumbHeight + 10) {
          track.style.display = "";
          track.style.height = `${trackHeight}px`;
          track.style.left = `${Math.round(rect.right - 9)}px`;
          track.style.top = `${Math.round(rect.top + EDGE_PAD)}px`;
        } else {
          track.style.display = "none";
        }
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
      tracks.forEach((track) => track.remove());
      pageThumb?.remove();
      pageTrack?.remove();
    };
  }, []);

  return null;
}
