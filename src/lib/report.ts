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
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
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
