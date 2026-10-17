import { saveFile, xlsxBlob } from "@/lib/report";
import type { CellStyle } from "xlsx-js-style";
import { safeSpreadsheetValue } from "./security-policy";

/** ล้างอักขระต้องห้ามของชื่อชีท Excel ( : \ / ? * [ ] ) ตัดเหลือ 31 ตัว และกันชื่อซ้ำ */
export function sanitizeSheetName(name: string, used?: Set<string>): string {
  let base = String(name ?? "")
    .replace(/[:\\/?*[\]\u0000-\u001f]/g, "-")
    .replace(/^'+|'+$/g, "")
    .trim();
  if (!base || base.toLowerCase() === "history") base = "Sheet";
  base = base.slice(0, 31);
  if (!used) return base;
  let out = base;
  let n = 2;
  while (used.has(out.toLowerCase())) {
    const suffix = ` (${n++})`;
    out = base.slice(0, 31 - suffix.length) + suffix;
  }
  used.add(out.toLowerCase());
  return out;
}

/** ล้างอักขระต้องห้ามของชื่อไฟล์ */
export function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-").trim() || "export";
}

export type GridSheet = {
  name: string;
  rows: (string | number | null)[][];
  merges?: { s: { r: number; c: number }; e: { r: number; c: number } }[];
  cols?: number[];
  rowHeights?: number[];
  styles?: Record<string, CellStyle>;
  defaultStyle?: CellStyle;
  autoFilter?: string;
};

export async function buildGridWorkbook(sheets: GridSheet[]) {
  const imported = await import("xlsx-js-style");
  const XLSX = imported.default ?? imported;
  const wb = XLSX.utils.book_new();
  const used = new Set<string>();
  for (const s of sheets) {
    const ws = XLSX.utils.aoa_to_sheet((s.rows.length ? s.rows : [[""]]).map((row) => row.map((v) => safeSpreadsheetValue(v))));
    if (s.merges?.length) ws["!merges"] = s.merges;
    if (s.cols) ws["!cols"] = s.cols.map((wch) => ({ wch }));
    if (s.rowHeights) ws["!rows"] = s.rowHeights.map((hpt) => ({ hpt }));
    if (s.defaultStyle || s.styles) {
      const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
      for (let r = range.s.r; r <= range.e.r; r++) {
        for (let c = range.s.c; c <= range.e.c; c++) {
          const address = XLSX.utils.encode_cell({ r, c });
          ws[address] ??= { t: "s", v: "" };
          ws[address].s = s.styles?.[address] ?? s.defaultStyle;
        }
      }
    }
    if (s.autoFilter) ws["!autofilter"] = { ref: s.autoFilter };
    XLSX.utils.book_append_sheet(wb, ws, sanitizeSheetName(s.name, used));
  }
  return xlsxBlob(XLSX.write(wb, { bookType: "xlsx", type: "array", cellStyles: true }));
}

export async function downloadGridWorkbook(sheets: GridSheet[], filename: string) {
  const blob = await buildGridWorkbook(sheets);
  const fname = sanitizeFileName(filename.replace(/\.xlsx$/i, "")) + ".xlsx";
  await saveFile(blob, fname);
}

/** แปลง <table> บนหน้าจอเป็นแถว (รองรับ colspan/rowspan) */
export function tableToGrid(table: HTMLTableElement, offsetRow = 0) {
  const rows: string[][] = [];
  const merges: GridSheet["merges"] = [];
  Array.from(table.rows).forEach((tr, r) => {
    rows[r] ??= [];
    let c = 0;
    Array.from(tr.cells).forEach((cell) => {
      while (rows[r][c] !== undefined) c++;
      const cs = cell.colSpan || 1;
      const rs = cell.rowSpan || 1;
      const text = (cell.innerText || cell.textContent || "").replace(/\n{2,}/g, "\n").trim();
      for (let i = 0; i < rs; i++)
        for (let j = 0; j < cs; j++) {
          rows[r + i] ??= [];
          rows[r + i][c + j] = i === 0 && j === 0 ? text : "";
        }
      if (cs > 1 || rs > 1)
        merges.push({ s: { r: r + offsetRow, c }, e: { r: r + offsetRow + rs - 1, c: c + cs - 1 } });
      c += cs;
    });
  });
  return { rows: rows.map((r) => Array.from(r, (v) => v ?? "")), merges };
}
