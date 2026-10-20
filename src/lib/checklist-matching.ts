type TypedTemplate = { pump_type?: string | null; machine_types?: string | null };

const normalize = (value: string) => value.trim().toLowerCase();

export function matchesType(template: TypedTemplate, type: string | null | undefined) {
  const target = normalize(type ?? "");
  if (!target) return false;
  if (template.pump_type?.trim()) return normalize(template.pump_type) === target;
  // Keep existing comma-separated templates compatible without matching unrelated types.
  return (template.machine_types ?? "").split(",").some((value) => normalize(value) === target);
}

export function findChecklistTemplate<T extends TypedTemplate>(templates: T[], type: string | null | undefined): T | undefined {
  return templates.find((template) => template.pump_type?.trim() && matchesType(template, type))
    ?? templates.find((template) => matchesType(template, type));
}