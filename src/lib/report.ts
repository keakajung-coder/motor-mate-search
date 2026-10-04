/** Shared helpers: date format, usage calculation, PDF export (size-capped) */

/** แสดงวันที่เป็น วว-ดด-ปปปป แบบพุทธศักราช (พ.ศ.) */
export function formatDate(d: string | null | undefined): string {
  if (!d) return "-";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return String(d);
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  return `${dd}-${mm}-${dt.getFullYear() + 543}`;
}

export type Usage = {
  used: number | null;
  remaining: number | null;
  percent: number | null;
  nextDate: string | null;
  overdue: boolean;
  baseDate: string | null;
};

/**
 * คำนวณชั่วโมงการใช้งานอะไหล่
 * ชม.สะสม = (วันนี้ - วันเปลี่ยนล่าสุด/วันติดตั้ง) x ชม.ต่อวัน  (หรือใช้ค่าที่กรอกเอง)
 */
export function computeUsage(opts: {
  lastChanged?: string | null;
  installDate?: string | null;
  intervalHours?: number | null;
  dailyHours?: number | null;
  manualHours?: number | null;
}): Usage {
  const { lastChanged, installDate, intervalHours, dailyHours, manualHours } = opts;
  const baseDate = lastChanged || installDate || null;
  let used: number | null = null;

  if (manualHours != null && manualHours > 0) {
    used = manualHours;
  } else if (baseDate && dailyHours && dailyHours > 0) {
    const start = new Date(baseDate).getTime();
    if (!isNaN(start)) {
      const days = Math.max(0, Math.floor((Date.now() - start) / 86400000));
      used = Math.round(days * dailyHours);
    }
  }

  const interval = intervalHours && intervalHours > 0 ? intervalHours : null;
  const remaining = used != null && interval != null ? interval - used : null;
  const percent =
    used != null && interval != null ? Math.min(200, Math.round((used / interval) * 100)) : null;

  let nextDate: string | null = null;
  if (baseDate && interval && dailyHours && dailyHours > 0) {
    const d = new Date(baseDate);
    if (!isNaN(d.getTime())) {
      d.setDate(d.getDate() + Math.round(interval / dailyHours));
      nextDate = d.toISOString().slice(0, 10);
    }
  }

  return {
    used,
    remaining,
    percent,
    nextDate,
    overdue: remaining != null ? remaining <= 0 : false,
    baseDate,
  };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.target = "_self";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  // iPad/iOS Safari บางเวอร์ชันไม่รองรับ a.download กับ blob: → เปิดแท็บใหม่แทน
  const supportsDownload = "download" in HTMLAnchorElement.prototype;
  if (!supportsDownload) window.open(url, "_blank");
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 4000);
}

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** เติม BOM ให้ไฟล์ข้อความ (CSV) เพื่อให้ภาษาไทยไม่เพี้ยน */
export function withBom(text: string): Uint8Array {
  return new TextEncoder().encode("\uFEFF" + text);
}

/** ล้างอักขระที่ Excel ห้ามใช้ในชื่อชีต ( \ / ? * [ ] : ) และจำกัด 31 ตัวอักษร */
export function safeSheetName(name: string, fallback = "Sheet1") {
  const clean = (name ?? "")
    .replace(/[\\/?*[\]:]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 31);
  return clean || fallback;
}

/** สร้าง Blob ไฟล์ Excel จาก byte array ของ xlsx */
export function xlsxBlob(data: ArrayBuffer | Uint8Array): Blob {
  return new Blob([data as any], { type: XLSX_MIME });
}


/**
 * บันทึกไฟล์ลงเครื่อง — รองรับ iPad/iOS (ลองใช้แชร์ไฟล์ก่อน แล้วค่อย fallback เป็นลิงก์ดาวน์โหลด)
 */
export async function saveFile(blob: Blob, filename: string) {
  const isIOS =
    typeof navigator !== "undefined" &&
    (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && (navigator as any).maxTouchPoints > 1));
  if (isIOS) {
    const file = new File([blob], filename, { type: blob.type });
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (nav.canShare?.({ files: [file] })) {
      try {
        await nav.share({ files: [file], title: filename });
        return "shared" as const;
      } catch {
        /* ผู้ใช้ยกเลิก → ดาวน์โหลดปกติ */
      }
    }
  }
  downloadBlob(blob, filename);
  return "downloaded" as const;
}


export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB — รักษาความคมชัดของตัวอักษรไทยในเอกสาร A4
const EXPORT_PIXEL_RATIO = 3;

/** จำกัดความละเอียดไม่ให้เกินขนาด canvas สูงสุดของเบราว์เซอร์ (iOS/Safari ~16.7M px) — เกินแล้วภาพจะว่างหรือค้าง */
export function safePixelRatio(width: number, height: number, desired = EXPORT_PIXEL_RATIO): number {
  const isIOS = typeof navigator !== "undefined" && /iP(hone|ad|od)|Macintosh.*Mobile/.test(navigator.userAgent);
  const maxArea = isIOS ? 16_000_000 : 60_000_000;
  const maxDim = isIOS ? 4096 * 4 : 16_000;
  const w = Math.max(1, width), h = Math.max(1, height);
  const byArea = Math.sqrt(maxArea / (w * h));
  const byDim = Math.min(maxDim / w, maxDim / h);
  return Math.max(1, Math.min(desired, byArea, byDim));
}

/** รอฟอนต์และการวาดเฟรมให้เสร็จก่อนจับภาพ เพื่อไม่ให้ตัวหนังสือหายหรือทับกัน */
export async function waitForPaint(): Promise<void> {
  try { await document.fonts.ready; } catch { /* ignore */ }
  await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
}

/**
 * แปลง element เป็น PDF โดยบีบอัดจนไฟล์ไม่เกิน 1 MB
 * ใช้ JPEG (บีบอัดได้) แทน PNG และลดคุณภาพ/ความละเอียดเป็นขั้นๆ
 */
export async function elementToPdfBlob(el: HTMLElement): Promise<Blob> {
  const [{ toJpeg }, { default: jsPDF }] = await Promise.all([
    import("html-to-image"),
    import("jspdf"),
  ]);

  const steps: Array<{ pixelRatio: number; quality: number }> = [
    { pixelRatio: EXPORT_PIXEL_RATIO, quality: 0.96 },
    { pixelRatio: 2.5, quality: 0.93 },
    { pixelRatio: 2, quality: 0.9 },
    { pixelRatio: 1.5, quality: 0.82 },
  ];

  await waitForPaint();
  let last: Blob | null = null;
  for (const step of steps) {
    const dataUrl = await toJpeg(el, {
      backgroundColor: "#ffffff",
      cacheBust: true,
      pixelRatio: safePixelRatio(el.scrollWidth, el.scrollHeight, step.pixelRatio),
      quality: step.quality,
      width: el.scrollWidth || undefined,
      height: el.scrollHeight || undefined,

    });
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = dataUrl;
    });

    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 8;
    const imgW = pageW - margin * 2;
    const imgH = (img.height * imgW) / img.width;

    let heightLeft = imgH;
    let position = margin;
    pdf.addImage(dataUrl, "JPEG", margin, position, imgW, imgH, undefined, "FAST");
    heightLeft -= pageH - margin * 2;
    while (heightLeft > 0) {
      position = margin - (imgH - heightLeft);
      pdf.addPage();
      pdf.addImage(dataUrl, "JPEG", margin, position, imgW, imgH, undefined, "FAST");
      heightLeft -= pageH - margin * 2;
    }

    last = pdf.output("blob");
    if (last.size <= MAX_BYTES) return last;
  }
  return last!;
}

/** สถานะเครื่องมาตรฐาน (พิมพ์เพิ่มเองได้) */
export const MACHINE_STATUSES = [
  "อยู่ในประกัน",
  "คอนแทรค",
  "ซื้ออะไหล่เปลี่ยนเอง",
  "เรียกเป็นครั้ง",
  "หลุดคอนแทรค",
  "ไม่ได้ใช้เครื่องแล้ว",
  "อื่นๆ",
];

/**
 * แปลง element เป็น PDF โดยกำหนดจำนวนหน้ากระดาษได้
 * ถ้าเนื้อหายาวกว่าจำนวนหน้าที่กำหนด จะย่อขนาดให้พอดี
 * pages = 0 หมายถึง "อัตโนมัติ" — ไม่ย่อ แบ่งหน้าตามความยาวจริง
 */
export async function elementToPdfBlobPaged(
  el: HTMLElement,
  pages: number,
  opts?: {
    orientation?: "portrait" | "landscape";
    size?: { width: number; height: number };
    maxBytes?: number;
    pixelRatio?: number;
    pageBreakSelector?: string;
  },
): Promise<Blob> {
  const [{ toJpeg }, { default: jsPDF }] = await Promise.all([
    import("html-to-image"),
    import("jspdf"),
  ]);
  await document.fonts.ready;
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  const captureWidth = Math.ceil(Math.max(opts?.size?.width ?? 0, el.scrollWidth, el.getBoundingClientRect().width));
  const captureHeight = Math.ceil(Math.max(opts?.size?.height ?? 0, el.scrollHeight, el.getBoundingClientRect().height));

  const steps: Array<{ pixelRatio: number; quality: number }> = [
    { pixelRatio: opts?.pixelRatio ?? EXPORT_PIXEL_RATIO, quality: 0.96 },
    { pixelRatio: 2.5, quality: 0.93 },
    { pixelRatio: 2, quality: 0.9 },
    { pixelRatio: 1.5, quality: 0.82 },
  ];

  let last: Blob | null = null;
  let lastError: unknown = null;
  for (const step of steps) {
    let dataUrl: string;
    try {
    dataUrl = await toJpeg(el, {
      backgroundColor: "#ffffff",
      cacheBust: true,
      pixelRatio: safePixelRatio(captureWidth, captureHeight, step.pixelRatio),
      quality: step.quality,
      ...(opts?.size
        ? {
            width: captureWidth,
            height: captureHeight,
            style: { width: `${captureWidth}px`, minHeight: `${captureHeight}px`, height: "auto" },
          }
        : { width: captureWidth, height: captureHeight }),
    });
    } catch (e) {
      lastError = e;
      continue;
    }
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = dataUrl;
    });

    const pdf = new jsPDF({
      unit: "mm",
      format: "a4",
      orientation: opts?.orientation ?? "portrait",
      compress: true,
    });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 8;
    const usableW = pageW - margin * 2;
    const usableH = pageH - margin * 2;

    let imgW = usableW;
    let imgH = (img.height * imgW) / img.width;

    // pages = 0 → อัตโนมัติ: ไม่ย่อ ให้เนื้อหากว้างเต็มหน้าแล้วแบ่งหน้าตามจริง
    const wanted = Math.max(0, Math.round(pages));
    if (wanted > 0) {
      const capacity = usableH * wanted;
      if (imgH > capacity) {
        const k = capacity / imgH;
        imgH *= k;
        imgW *= k;
      }
    }
    const offsetX = margin + (usableW - imgW) / 2;

    const sourcePageHeight = (img.width * usableH) / imgW;
    const renderedWidth = captureWidth;
    const sourceScale = img.width / renderedWidth;
    const rootTop = el.getBoundingClientRect().top;
    const candidates = opts?.pageBreakSelector
      ? Array.from(el.querySelectorAll<HTMLElement>(opts.pageBreakSelector))
          .map((node) => (node.getBoundingClientRect().bottom - rootTop) * sourceScale)
          .filter((value) => value > 0 && value < img.height)
          .sort((a, b) => a - b)
      : [];
    const slices: Array<{ top: number; height: number }> = [];
    let sourceTop = 0;
    while (sourceTop < img.height - 1) {
      const remaining = img.height - sourceTop;
      if (slices.length > 0 && remaining <= Math.max(12, sourcePageHeight * 0.02)) {
        slices[slices.length - 1].height += remaining;
        break;
      }
      const target = Math.min(img.height, sourceTop + sourcePageHeight);
      const safeBreak = candidates.filter((value) => value > sourceTop + sourcePageHeight * 0.55 && value <= target).at(-1);
      const bottom = safeBreak ?? target;
      slices.push({ top: sourceTop, height: Math.max(1, bottom - sourceTop) });
      sourceTop = bottom;
    }
    if (slices.length > 1 && slices[slices.length - 1].height < sourcePageHeight * 0.08) {
      const trailing = slices.pop();
      if (trailing) slices[slices.length - 1].height += trailing.height;
    }
    const total = slices.length;
    slices.forEach((slice, p) => {
      if (p > 0) pdf.addPage();
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = Math.ceil(slice.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("ไม่สามารถสร้างหน้ารายงานได้");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, slice.top, img.width, slice.height, 0, 0, img.width, slice.height);
      const pageDataUrl = canvas.toDataURL("image/jpeg", step.quality);
      const pageImgH = (slice.height * imgW) / img.width;
      pdf.addImage(pageDataUrl, "JPEG", offsetX, margin, imgW, pageImgH, undefined, "SLOW");
    });
    // เติมหน้าว่างให้ครบตามจำนวนที่ผู้ใช้กำหนด
    for (let p = total; p < wanted; p++) pdf.addPage();

    last = pdf.output("blob");
    if (last.size <= (opts?.maxBytes ?? MAX_BYTES)) return last;
  }
  if (!last) throw lastError instanceof Error ? lastError : new Error("สร้างไฟล์ไม่สำเร็จ");
  return last;
}

/* ---------- ส่งออกใบสั่งงานให้พอดีกระดาษ A4 หน้าเดียว ---------- */

const A4_W_PX = 1240; // A4 @150dpi
const A4_H_PX = 1754;
const A4_MARGIN = 56;

/** จับภาพ element เป็น <img> ตามขนาดจริง (ไม่ถูกตัด) */
async function captureElement(el: HTMLElement, pixelRatio = EXPORT_PIXEL_RATIO): Promise<HTMLImageElement> {
  const { toJpeg } = await import("html-to-image");
  const width = el.scrollWidth || el.offsetWidth;
  const height = el.scrollHeight || el.offsetHeight;
  await waitForPaint();
  pixelRatio = safePixelRatio(width, height, pixelRatio);
  const dataUrl = await toJpeg(el, {
    backgroundColor: "#ffffff",
    cacheBust: true,
    pixelRatio,
    quality: 0.96,
    width,
    height,
    style: { width: `${width}px`, height: `${height}px` },
  });
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = dataUrl;
  });
}

/** วาดภาพลงหน้ากระดาษ A4 (ย่อ/ขยายให้พอดีหน้าเดียว จัดกึ่งกลางแนวนอน) */
function drawOnA4(img: HTMLImageElement, quality = 0.9): { canvas: HTMLCanvasElement; dataUrl: string } {
  const canvas = document.createElement("canvas");
  canvas.width = A4_W_PX;
  canvas.height = A4_H_PX;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, A4_W_PX, A4_H_PX);

  const maxW = A4_W_PX - A4_MARGIN * 2;
  const maxH = A4_H_PX - A4_MARGIN * 2;
  const scale = Math.min(maxW / img.width, maxH / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, (A4_W_PX - w) / 2, A4_MARGIN, w, h);
  return { canvas, dataUrl: canvas.toDataURL("image/jpeg", quality) };
}

/** ส่งออก element เป็นรูปภาพขนาด A4 หน้าเดียว */
export async function elementToA4ImageBlob(el: HTMLElement): Promise<Blob> {
  const img = await captureElement(el, EXPORT_PIXEL_RATIO);
  const { dataUrl } = drawOnA4(img, 0.96);
  return await (await fetch(dataUrl)).blob();
}

/** ส่งออก element (หนึ่งหรือหลายใบ) เป็น PDF A4 — หนึ่งใบต่อหนึ่งหน้า พอดีหน้า */
export async function elementsToA4PdfBlob(
  els: HTMLElement[],
  opts?: { maxBytes?: number; pixelRatio?: number },
): Promise<Blob> {
  const { default: jsPDF } = await import("jspdf");
  const imgs: HTMLImageElement[] = [];
  for (const el of els) imgs.push(await captureElement(el, opts?.pixelRatio ?? EXPORT_PIXEL_RATIO));

  let quality = 0.96;
  let blob: Blob | null = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    imgs.forEach((img, i) => {
      if (i > 0) pdf.addPage();
      const { dataUrl } = drawOnA4(img, quality);
      pdf.addImage(dataUrl, "JPEG", 0, 0, pageW, pageH, undefined, "SLOW");
    });
    blob = pdf.output("blob");
    if (blob.size <= (opts?.maxBytes ?? MAX_BYTES)) return blob;
    quality -= 0.08;
    if (quality < 0.68) break;
  }
  return blob!;
}

/**
 * สร้าง PDF ตาราง โดยวาดด้วย Canvas (รองรับฟอนต์ไทยของเครื่องแน่นอน)
 * แบ่งหน้าอัตโนมัติ และบีบ JPEG จนไฟล์ไม่เกิน 1 MB
 */
export async function tableToPdfBlob(
  title: string,
  columns: string[],
  rows: Array<Record<string, any>>,
  headerLabels?: Record<string, string>,
): Promise<Blob> {
  const { default: jsPDF } = await import("jspdf");

  const probe = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape", compress: true });
  const pageW = probe.internal.pageSize.getWidth();
  const pageH = probe.internal.pageSize.getHeight();
  const margin = 8;
  const usableW = pageW - margin * 2;
  const usableH = pageH - margin * 2;

  // canvas layout (px)
  const scale = 3;
  const cw = 1400;
  const pad = 8;
  const fs = 20;
  const rowH = 44;
  const headH = 40;
  const titleH = 46;

  const cellW = Math.floor((cw - pad * 2) / Math.max(1, columns.length));
  const rowsPerPage = Math.max(
    1,
    Math.floor(((usableH / usableW) * cw - titleH - headH - pad * 2) / rowH),
  );
  const pages = Math.max(1, Math.ceil(rows.length / rowsPerPage));

  const clip = (ctx: CanvasRenderingContext2D, text: string, w: number) => {
    let t = text;
    if (ctx.measureText(t).width <= w) return t;
    while (t.length > 1 && ctx.measureText(t + "…").width > w) t = t.slice(0, -1);
    return t + "…";
  };

  let quality = 0.95;
  let blob: Blob | null = null;

  for (let attempt = 0; attempt < 4; attempt++) {
    const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape", compress: true });
    for (let p = 0; p < pages; p++) {
      const pageRows = rows.slice(p * rowsPerPage, (p + 1) * rowsPerPage);
      const ch = titleH + headH + pageRows.length * rowH + pad * 2;
      const canvas = document.createElement("canvas");
      canvas.width = cw * scale;
      canvas.height = ch * scale;
      const ctx = canvas.getContext("2d")!;
      ctx.scale(scale, scale);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, cw, ch);
      ctx.textBaseline = "middle";

      ctx.fillStyle = "#111111";
      ctx.font = `bold 26px "Sarabun", "Noto Sans Thai", system-ui, sans-serif`;
      ctx.fillText(`${title} (${rows.length} รายการ) — หน้า ${p + 1}/${pages}`, pad, pad + titleH / 2);

      // header
      let y = pad + titleH;
      ctx.fillStyle = "#eeeeee";
      ctx.fillRect(pad, y, cellW * columns.length, headH);
      ctx.font = `bold ${fs}px "Sarabun", "Noto Sans Thai", system-ui, sans-serif`;
      ctx.strokeStyle = "#bbbbbb";
      ctx.lineWidth = 1;
      columns.forEach((c, i) => {
        const x = pad + i * cellW;
        ctx.strokeRect(x, y, cellW, headH);
        ctx.fillStyle = "#111111";
        ctx.fillText(clip(ctx, headerLabels?.[c] ?? c, cellW - 10), x + 5, y + headH / 2);
      });

      // rows
      ctx.font = `${fs}px "Sarabun", "Noto Sans Thai", system-ui, sans-serif`;
      pageRows.forEach((r, ri) => {
        const ry = y + headH + ri * rowH;
        if (ri % 2 === 1) {
          ctx.fillStyle = "#f7f7f7";
          ctx.fillRect(pad, ry, cellW * columns.length, rowH);
        }
        columns.forEach((c, i) => {
          const x = pad + i * cellW;
          ctx.strokeRect(x, ry, cellW, rowH);
          ctx.fillStyle = "#222222";
          ctx.fillText(clip(ctx, String(r[c] ?? ""), cellW - 10), x + 5, ry + rowH / 2);
        });
      });

      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      if (p > 0) doc.addPage();
      const imgW = usableW;
      const imgH = Math.min(usableH, (ch * imgW) / cw);
      doc.addImage(dataUrl, "JPEG", margin, margin, imgW, imgH, undefined, "FAST");
    }
    blob = doc.output("blob");
    if (blob.size <= MAX_BYTES) return blob;
    quality -= 0.08;
    if (quality < 0.68) break;
  }
  return blob!;
}

/** แชร์ไฟล์ (มือถือ) หรือดาวน์โหลด (เดสก์ท็อป) */
export async function shareOrDownload(blob: Blob, filename: string, title?: string) {
  const file = new File([blob], filename, { type: blob.type });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: title ?? filename });
      return "shared" as const;
    } catch {
      /* fall through */
    }
  }
  downloadBlob(blob, filename);
  return "downloaded" as const;
}

export const THAI_PROVINCES = [
  "กระบี่","กาญจนบุรี","กาฬสินธุ์","กำแพงเพชร","ขอนแก่น","จันทบุรี","ฉะเชิงเทรา","ชลบุรี","ชัยนาท","ชัยภูมิ",
  "ชุมพร","เชียงราย","เชียงใหม่","ตรัง","ตราด","ตาก","นครนายก","นครปฐม","นครพนม","นครราชสีมา",
  "นครศรีธรรมราช","นครสวรรค์","นนทบุรี","นราธิวาส","น่าน","บึงกาฬ","บุรีรัมย์","ปทุมธานี","ประจวบคีรีขันธ์","ปราจีนบุรี",
  "ปัตตานี","พระนครศรีอยุธยา","พะเยา","พังงา","พัทลุง","พิจิตร","พิษณุโลก","เพชรบุรี","เพชรบูรณ์","แพร่",
  "ภูเก็ต","มหาสารคาม","มุกดาหาร","แม่ฮ่องสอน","ยโสธร","ยะลา","ร้อยเอ็ด","ระนอง","ระยอง","ราชบุรี",
  "ลพบุรี","ลำปาง","ลำพูน","เลย","ศรีสะเกษ","สกลนคร","สงขลา","สตูล","สมุทรปราการ","สมุทรสงคราม",
  "สมุทรสาคร","สระแก้ว","สระบุรี","สิงห์บุรี","สุโขทัย","สุพรรณบุรี","สุราษฎร์ธานี","สุรินทร์","หนองคาย","หนองบัวลำภู",
  "อ่างทอง","อำนาจเจริญ","อุดรธานี","อุตรดิตถ์","อุทัยธานี","อุบลราชธานี","กรุงเทพมหานคร",
];

/** ตรวจว่าเครื่องลงข้อมูลครบถ้วนหรือยัง */
/**
 * ความครบถ้วนของข้อมูลเครื่อง = แอดมินติ๊ก "ตรวจสอบและลงข้อมูลครบถ้วนแล้ว"
 * (ป้ายเขียว = ติ๊กแล้ว / ป้ายส้ม-แดง = ยังไม่ติ๊ก)
 */
export function isMachineComplete(u: { data_complete?: boolean | null }): boolean {
  return Boolean(u?.data_complete);
}

