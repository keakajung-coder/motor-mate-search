/** ย่อและบีบอัดรูปภาพในเบราว์เซอร์ก่อนอัปโหลด (คงความคมชัดพอใช้งาน) */
export type CompressOptions = { maxSize?: number; quality?: number; type?: "image/jpeg" | "image/webp" };

export function fitWithin(w: number, h: number, max: number) {
  if (w <= max && h <= max) return { width: w, height: h };
  const r = Math.min(max / w, max / h);
  return { width: Math.round(w * r), height: Math.round(h * r) };
}

async function loadImage(file: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

export async function compressImage(file: File, opts: CompressOptions = {}): Promise<File> {
  const { maxSize = 1600, quality = 0.82, type = "image/jpeg" } = opts;
  if (!file.type.startsWith("image/") || file.type === "image/gif" || file.type === "image/svg+xml") return file;
  let img: HTMLImageElement;
  try {
    img = await loadImage(file);
  } catch {
    return file; // ถอดรหัสไม่ได้ ใช้ไฟล์เดิม
  }
  const { width, height } = fitWithin(img.naturalWidth, img.naturalHeight, maxSize);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.fillStyle = "#ffffff"; // พื้นขาวสำหรับ PNG โปร่งใส → JPEG
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, type, quality));
  if (!blob) return file;
  // ถ้าบีบแล้วใหญ่กว่าเดิมและเป็นชนิดที่รองรับอยู่แล้ว ใช้ไฟล์เดิม
  if (blob.size >= file.size && (file.type === "image/jpeg" || file.type === "image/webp") && img.naturalWidth <= maxSize && img.naturalHeight <= maxSize) return file;
  const ext = type === "image/webp" ? "webp" : "jpg";
  const name = file.name.replace(/\.[^/.]+$/, "") + "." + ext;
  return new File([blob], name, { type, lastModified: Date.now() });
}

export function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(file);
  });
}
