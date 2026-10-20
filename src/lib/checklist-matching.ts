type TypedTemplate = { pump_type?: string | null; machine_types?: string | null };

const normalize = (value: string) => value.trim().toLowerCase();
const canonical = (value: string) => normalize(value).replace(/^ปั๊มลม\s*/, "");

export function matchesType(template: TypedTemplate, type: string | null | undefined) {
  const target = normalize(type ?? "");
  if (!target) return false;
  const canonicalTarget = canonical(target);
  if (template.pump_type?.trim()) {
    return canonical(template.pump_type) === canonicalTarget;
  }
  return (template.machine_types ?? "").split(",").some((value) => {
    const keyword = normalize(value);
    return Boolean(keyword) && (canonical(keyword) === canonicalTarget || target.includes(keyword) || keyword.includes(target));
  });
}

export function findChecklistTemplate<T extends TypedTemplate>(templates: T[], type: string | null | undefined): T | undefined {
  return templates.find((template) => template.pump_type?.trim() && matchesType(template, type))
    ?? templates.find((template) => matchesType(template, type));
}