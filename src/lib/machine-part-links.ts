import { addTag, type PartPickRow } from "./parts-search";

export type MachinePartLink = {
  machine_unit_id?: string | null;
  product_id?: string | null;
  cross_reference_parts?: string[] | null;
  substitution_note?: string | null;
  machine_units?: { serial_number?: string | null } | null;
};

/** Relation-specific codes stay scoped to the selected machines, never mutate inventory. */
export function linkedPartCatalog(products: PartPickRow[], links: MachinePartLink[]): PartPickRow[] {
  const rows = products.filter(Boolean).map((p) => ({ ...p, cross_reference_parts: [...(p.cross_reference_parts ?? [])] }));
  const byId = new Map(rows.map((p) => [p.id, p]));
  const byCode = new Map(rows.map((p) => [(p.part_number ?? "").trim().toLowerCase(), p]));
  for (const link of links.filter(Boolean)) {
    const main = link.product_id ? byId.get(link.product_id) : undefined;
    if (!main) continue;
    const codes = Array.isArray(link.cross_reference_parts) ? link.cross_reference_parts : [];
    for (const code of codes) {
      if (!code?.trim()) continue;
      main.cross_reference_parts = addTag(main.cross_reference_parts, code);
      const key = code.trim().toLowerCase();
      let alt = byCode.get(key);
      if (!alt) {
        alt = { id: `cross-ref:${key}`, part_number: code.trim(), name: "พาร์ททดแทน", cross_reference_parts: [] };
        rows.push(alt);
        byCode.set(key, alt);
      }
      if (main.part_number && alt.id !== main.id) alt.cross_reference_parts = addTag(alt.cross_reference_parts ?? [], main.part_number);
    }
  }
  return rows;
}

export function partLine(part: PartPickRow, kind: "แท้" | "เทียบ") {
  return `${part.part_number ?? ""} · ${part.name ?? ""} (${kind})`.trim();
}