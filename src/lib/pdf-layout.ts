export type PdfOrientation = "portrait" | "landscape";
export type PdfCaptionMode = "none" | "each" | "shared";
export type PdfSettings = {
  orientation: PdfOrientation;
  pages: number;
  /** Image captions: hide, keep each photo's own caption, or reuse one shared text. */
  caption?: PdfCaptionMode;
  captionText?: string;
  /** Enlarge body/heading text for reading on small screens. */
  largeText?: boolean;
  /** Paper margin preset. */
  margin?: PdfMargin;
  /** Optional 1-based inclusive page range to keep; empty means all pages. */
  pageFrom?: number;
  pageTo?: number;
};
export type PdfMargin = "narrow" | "normal" | "wide";
export const PDF_MARGIN_MM: Record<PdfMargin, number> = { narrow: 5, normal: 10, wide: 20 };
export const PDF_MAX_BYTES = 1024 * 1024;

export function marginMm(settings: Pick<PdfSettings, "margin">) {
  return PDF_MARGIN_MM[settings.margin ?? "normal"] ?? PDF_MARGIN_MM.normal;
}

/** 0-based page indexes to keep for a requested range (clamped to the document). */
export function pagesInRange(total: number, settings: Pick<PdfSettings, "pageFrom" | "pageTo">): number[] {
  const from = Math.max(1, Math.floor(settings.pageFrom || 1));
  const to = Math.min(total, Math.floor(settings.pageTo || total));
  const out: number[] = [];
  for (let i = from; i <= to; i++) out.push(i - 1);
  return out.length ? out : Array.from({ length: total }, (_, i) => i);
}

/** Caption text a photo should show for the chosen mode; null means hide it. */
export function photoCaption(own: string, settings: Pick<PdfSettings, "caption" | "captionText">): string | null {
  const mode = settings.caption ?? "each";
  if (mode === "none") return null;
  if (mode === "shared") return (settings.captionText ?? "").trim() || null;
  return own;
}

/**
 * Page count is a maximum, never a reason to omit content or append blank pages.
 * `repeat` is the source-pixel height of a header drawn again at the top of every page after the first.
 */
export function pdfLayout(width: number, height: number, settings: PdfSettings, breaks: number[] = [], repeat = 0) {
  const pageWidth = settings.orientation === "landscape" ? 297 : 210;
  const pageHeight = settings.orientation === "landscape" ? 210 : 297;
  const m = marginMm(settings);
  const usableWidth = pageWidth - m * 2;
  const usableHeight = pageHeight - m * 2;
  const limit = Number.isFinite(settings.pages) ? Math.max(0, Math.floor(settings.pages)) : 0;
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const edges = breaks.filter(x => x > 0 && x < safeHeight).sort((a, b) => a - b);
  const sliceAt = (imageWidth: number) => {
    const full = safeWidth * usableHeight / imageWidth;
    // Never let a repeated header eat more than 40% of a page.
    const header = Math.max(0, Math.min(repeat, full * 0.4));
    const slices: { top: number; height: number }[] = [];
    let top = 0;
    while (top < safeHeight - 0.001) {
      const capacity = slices.length === 0 ? full : full - header;
      const target = top + capacity >= safeHeight - 0.001 ? safeHeight : top + capacity;
      const edge = target < safeHeight ? edges.filter(x => x > top + capacity * 0.3 && x <= target).at(-1) : undefined;
      const bottom = edge ?? target;
      slices.push({ top, height: bottom - top });
      top = bottom;
    }
    return slices;
  };
  let imageWidth = usableWidth;
  let slices = sliceAt(imageWidth);
  if (limit > 0 && slices.length > limit) {
    let low = Math.min(usableWidth, usableHeight * safeWidth / safeHeight);
    let high = usableWidth;
    for (let i = 0; i < 40; i++) {
      const mid = (low + high) / 2;
      if (sliceAt(mid).length <= limit) low = mid;
      else high = mid;
    }
    imageWidth = low;
    slices = sliceAt(imageWidth);
  }
  const header = Math.max(0, Math.min(repeat, safeWidth * usableHeight / imageWidth * 0.4));
  return { pageWidth, pageHeight, imageWidth, offsetX: m + (usableWidth - imageWidth) / 2, slices, header, margin: m };
}
