/**
 * ตัวช่วยค้นหาอะไหล่แบบ Omni-Search (pure, ทดสอบได้)
 * ครอบคลุม: รหัสพาร์ทหลัก, รหัสพาร์ทเทียบ, ชื่ออะไหล่, ยี่ห้อ, หมวดหมู่ และ S/N ที่ผูกกับเครื่อง
 */

export type PartSearchable = {
  name?: string | null;
  part_number?: string | null;
  cross_reference_parts?: string[] | null;
  supported_serials?: string[] | null;
  brandName?: string | null;
  categoryName?: string | null;
  modelName?: string | null;
  /** S/N ของเครื่องที่ใช้อะไหล่ชิ้นนี้ (จาก machine_parts) */
  linkedSerials?: string[];
};

const norm = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();

/** รวมทุกฟิลด์ที่ค้นหาได้ของอะไหล่ 1 ชิ้นเป็นข้อความเดียว */
export function partSearchText(p: PartSearchable): string {
  return [
    p.part_number,
    p.name,
    p.brandName,
    p.categoryName,
    p.modelName,
    ...(p.cross_reference_parts ?? []),
    ...(p.supported_serials ?? []),
    ...(p.linkedSerials ?? []),
  ]
    .map(norm)
    .filter(Boolean)
    .join(" ");
}

/** ค้นหาแบบ real-time: คำค้นตรงกับฟิลด์ใดฟิลด์หนึ่ง (ไม่คำนึงตัวพิมพ์) */
export function partMatchesKeyword(p: PartSearchable, keyword: string): boolean {
  const kw = norm(keyword);
  if (!kw) return true;
  return partSearchText(p).includes(kw);
}

/** แยกข้อความ multi-tag: รองรับ Enter, จุลภาค, อัฒภาค และเว้นวรรคหลายช่อง */
export function parseTags(input: string): string[] {
  return input
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** เพิ่ม tag ใหม่เข้า list โดยไม่ซ้ำ (ไม่คำนึงตัวพิมพ์) */
export function addTag(list: string[], tag: string): string[] {
  const t = tag.trim();
  if (!t) return list;
  if (list.some((x) => x.trim().toLowerCase() === t.toLowerCase())) return list;
  return [...list, t];
}

/** ลบ tag ออกจาก list ตามค่าที่ตรงกัน */
export function removeTag(list: string[], tag: string): string[] {
  return list.filter((x) => x !== tag);
}

export type PartPickRow = {
  id: string;
  name?: string | null;
  part_number?: string | null;
  cross_reference_parts?: string[] | null;
  supported_serials?: string[] | null;
};

/**
 * แยกผลค้นหาอะไหล่เป็น "อะไหล่แท้" (ผูกกับเครื่อง/S/N ที่ค้นเจอ หรือรหัสหลักตรงคำค้น)
 * และ "อะไหล่เทียบ" (รหัสอยู่ในรายการเทียบของอะไหล่แท้ หรือคำค้นตรงเฉพาะรหัสเทียบ)
 * ปลอดภัยกับค่า null/undefined ทุกฟิลด์
 */
export function splitGenuineCrossRef(
  products: PartPickRow[],
  opts: { keyword?: string | null; serials?: string[]; linkedProductIds?: Iterable<string> },
): { genuine: PartPickRow[]; crossRef: PartPickRow[] } {
  const kw = norm(opts.keyword);
  const serials = new Set((opts.serials ?? []).map(norm).filter(Boolean));
  const linked = new Set(opts.linkedProductIds ?? []);
  const list = (Array.isArray(products) ? products : []).filter((p) => p && p.id);
  const crossOf = (p: PartPickRow) => (Array.isArray(p.cross_reference_parts) ? p.cross_reference_parts : []).map(norm).filter(Boolean);
  const genuine: PartPickRow[] = [];
  const gIds = new Set<string>();
  for (const p of list) {
    const pn = norm(p.part_number);
    const sup = (Array.isArray(p.supported_serials) ? p.supported_serials : []).map(norm);
    const hit =
      linked.has(p.id) ||
      sup.some((s) => s && serials.has(s)) ||
      (!!kw && (pn.includes(kw) || norm(p.name).includes(kw) || sup.some((s) => s.includes(kw))));
    if (hit) { genuine.push(p); gIds.add(p.id); }
  }
  const gNums = new Set(genuine.map((p) => norm(p.part_number)).filter(Boolean));
  const gCross = new Set(genuine.flatMap(crossOf));
  const crossRef = list.filter((p) => {
    if (gIds.has(p.id)) return false;
    const pn = norm(p.part_number);
    if (pn && gCross.has(pn)) return true;
    const cr = crossOf(p);
    if (cr.some((c) => gNums.has(c))) return true;
    return !!kw && cr.some((c) => c.includes(kw));
  });
  return { genuine: genuine.slice(0, 30), crossRef: crossRef.slice(0, 30) };
}
