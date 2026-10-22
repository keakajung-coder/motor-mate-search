/** ตรรกะกระจายงวดเข้าบริการตามสัญญารายปี (pure function ทดสอบได้) */

const pad = (n: number) => String(n).padStart(2, "0");

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** บวกเดือนโดยไม่เลื่อนวันที่เกินสิ้นเดือน (31 ม.ค. + 1 เดือน → 28/29 ก.พ.) */
export function addMonthsClamped(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const total = (y ?? 0) * 12 + (m ?? 1) - 1 + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const lastDay = new Date(ny, nm, 0).getDate();
  return `${ny}-${pad(nm)}-${pad(Math.min(d ?? 1, lastDay))}`;
}

/**
 * กระจายงวด n ครั้งในรอบ 12 เดือน นับจากวันเริ่มสัญญา
 * เช่น start 2026-01-15, 4 ครั้ง → 15 ม.ค. / 15 เม.ย. / 15 ก.ค. / 15 ต.ค.
 * (ถ้ามากกว่า 12 ครั้ง จะกระจายแบบรายวันแทน เพื่อไม่ให้วันซ้ำกัน)
 */
export function spreadVisits(startDate: string, count: number): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || count < 1) return [];
  const n = Math.min(Math.floor(count), 52);
  if (n <= 12) {
    const step = 12 / n;
    const out: string[] = [];
    for (let i = 0; i < n; i++) out.push(addMonthsClamped(startDate, Math.round(step * i)));
    return Array.from(new Set(out));
  }
  const base = new Date(`${startDate}T00:00:00`);
  const out = new Set<string>();
  for (let i = 0; i < n; i++) {
    const d = new Date(base);
    d.setDate(d.getDate() + Math.round((365 / n) * i));
    out.add(toISODate(d));
  }
  return Array.from(out);
}

/** เลขที่ใบงานอัตโนมัติ (รูปแบบเดียวกับ WorkOrderDialog) */
export function autoContractJobNo(now = new Date()): string {
  return `JO-${String(now.getFullYear()).slice(2)}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
}
