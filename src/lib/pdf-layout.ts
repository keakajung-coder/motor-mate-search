export type PdfOrientation = "portrait" | "landscape";
export type PdfSettings = { orientation: PdfOrientation; pages: number };

/** Page count is a maximum, never a reason to omit content or append blank pages. */
export function pdfLayout(width: number, height: number, settings: PdfSettings, breaks: number[] = []) {
  const pageWidth = settings.orientation === "landscape" ? 297 : 210;
  const pageHeight = settings.orientation === "landscape" ? 210 : 297;
  const usableWidth = pageWidth - 16;
  const usableHeight = pageHeight - 16;
  const limit = Number.isFinite(settings.pages) ? Math.max(0, Math.floor(settings.pages)) : 0;
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const edges = breaks.filter(x => x > 0 && x < safeHeight).sort((a, b) => a - b);
  const sliceAt = (imageWidth: number) => {
    const capacity = safeWidth * usableHeight / imageWidth;
    const slices: { top: number; height: number }[] = [];
    let top = 0;
    while (top < safeHeight - 0.001) {
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
  return { pageWidth, pageHeight, imageWidth, offsetX: 8 + (usableWidth - imageWidth) / 2, slices };
}