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
