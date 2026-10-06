import type { PdfSettings } from "./pdf-layout";

/** Open the shared preview lazily, so PDF UI is never evaluated by SSR. */
export async function controlledPdf(build: (settings: PdfSettings) => Promise<Blob>, initial: PdfSettings): Promise<Blob> {
  const { openPdfControls } = await import("@/components/PdfExportControls");
  return openPdfControls(build, initial);
}