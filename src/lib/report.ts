/** Shared helpers: date format, usage calculation, PDF export (size-capped) */

export function formatDate(d: string | null | undefined): string {
  if (!d) return "-";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return String(d);
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${dt.getFullYear()}`;
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

const MAX_BYTES = 1024 * 1024; // 1 MB

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
    { pixelRatio: 2, quality: 0.82 },
    { pixelRatio: 1.5, quality: 0.7 },
    { pixelRatio: 1.2, quality: 0.6 },
    { pixelRatio: 1, quality: 0.5 },
    { pixelRatio: 0.85, quality: 0.4 },
  ];

  let last: Blob | null = null;
  for (const step of steps) {
    const dataUrl = await toJpeg(el, {
      backgroundColor: "#ffffff",
      cacheBust: true,
      pixelRatio: step.pixelRatio,
      quality: step.quality,
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
 */
export async function elementToPdfBlobPaged(
  el: HTMLElement,
  pages: number,
  opts?: { orientation?: "portrait" | "landscape" },
): Promise<Blob> {
  const [{ toJpeg }, { default: jsPDF }] = await Promise.all([
    import("html-to-image"),
    import("jspdf"),
  ]);

  const steps: Array<{ pixelRatio: number; quality: number }> = [
    { pixelRatio: 2, quality: 0.82 },
    { pixelRatio: 1.5, quality: 0.7 },
    { pixelRatio: 1.2, quality: 0.6 },
    { pixelRatio: 1, quality: 0.5 },
    { pixelRatio: 0.85, quality: 0.4 },
  ];

  let last: Blob | null = null;
  for (const step of steps) {
    const dataUrl = await toJpeg(el, {
      backgroundColor: "#ffffff",
      cacheBust: true,
      pixelRatio: step.pixelRatio,
      quality: step.quality,
    });
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

    const wanted = Math.max(1, Math.round(pages));
    const capacity = usableH * wanted;
    if (imgH > capacity) {
      const k = capacity / imgH;
      imgH *= k;
      imgW *= k;
    }

    const total = Math.max(1, Math.ceil(imgH / usableH - 0.001));
    for (let p = 0; p < total; p++) {
      if (p > 0) pdf.addPage();
      pdf.addImage(dataUrl, "JPEG", margin, margin - p * usableH, imgW, imgH, undefined, "FAST");
    }
    // เติมหน้าว่างให้ครบตามจำนวนที่ผู้ใช้กำหนด
    for (let p = total; p < wanted; p++) pdf.addPage();

    last = pdf.output("blob");
    if (last.size <= MAX_BYTES) return last;
  }
  return last!;
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
  const scale = 2;
  const cw = 1400;
  const pad = 8;
  const fs = 20;
  const rowH = 34;
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

  let quality = 0.85;
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
    quality -= 0.2;
    if (quality < 0.3) break;
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
export function isMachineComplete(u: {
  serial_number?: string | null;
  model_id?: string | null;
  customer_id?: string | null;
  install_date?: string | null;
  daily_hours?: number | null;
  seller?: string | null;
  status?: string | null;
}): boolean {
  return Boolean(
    u.serial_number?.trim() &&
      u.model_id &&
      u.customer_id &&
      u.install_date &&
      u.daily_hours != null &&
      (u.seller ?? "").trim() &&
      (u.status ?? "").trim()
  );
}
