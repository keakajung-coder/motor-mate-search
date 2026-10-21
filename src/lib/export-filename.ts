type ExportDate = Date | string;
type ExportExtension = "pdf" | "xlsx" | "jpg" | "png" | "csv";
const THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

function dateParts(value: ExportDate) {
  // Parse calendar strings locally; UTC conversion can shift the selected day.
  const date = typeof value === "string" ? new Date(`${value}T00:00:00`) : value;
  if (Number.isNaN(date.getTime())) throw new Error("วันที่สำหรับชื่อไฟล์ไม่ถูกต้อง");
  return {
    day: String(date.getDate()).padStart(2, "0"),
    month: THAI_MONTHS[date.getMonth()],
    year: String(date.getFullYear() + 543),
  };
}

export function exportDateLabel(start: ExportDate, end?: ExportDate) {
  const a = dateParts(start);
  const full = (d: ReturnType<typeof dateParts>) => `${d.day}-${d.month}-${d.year}`;
  if (!end) return full(a);
  const b = dateParts(end);
  if (full(a) === full(b)) return full(a);
  if (a.year !== b.year || a.month !== b.month) return `${full(a)}-ถึง-${full(b)}`;
  return `${a.day}-ถึง-${full(b)}`;
}

/** One shared base name for downloads and native file sharing. */
export function exportFilename(type: string, start: ExportDate, extension: ExportExtension, end?: ExportDate) {
  const safeType = type.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-").trim();
  return `${safeType}-${exportDateLabel(start, end)}.${extension}`;
}

export function plannerExportLabel(view: "month" | "week" | "day", cursor: Date) {
  if (view === "day") return exportDateLabel(cursor);
  if (view === "month") {
    return `เดือน-${exportDateLabel(new Date(cursor.getFullYear(), cursor.getMonth(), 1), new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0))}`;
  }
  const start = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return `สัปดาห์-${exportDateLabel(start, end)}`;
}