export function activeSellerNames(contacts: { name: string; active?: boolean }[], options: string[]): string[] {
  const normalize = (name: string) => name.trim().toLocaleLowerCase();
  const inactive = new Set(contacts.filter(row => row.active === false).map(row => normalize(row.name)));
  const active = new Set(contacts.filter(row => row.active !== false).map(row => normalize(row.name)));
  return [...contacts.filter(row => row.active !== false).map(row => row.name), ...options]
    .filter(name => !inactive.has(normalize(name)) || active.has(normalize(name)));
}

export function deactivateEngineerRecords(records: unknown[], sourceId: string, name: string) {
  let found = false;
  const updated = records.map((item, index) => {
    const row = typeof item === "string" ? { name: item.trim() } : item;
    if (!row || typeof row !== "object" || !("name" in row)) return item;
    const label = String(row.name ?? "").trim();
    const id = "id" in row ? String(row.id) : `eng-${index}-${label}`;
    if (id !== sourceId && label.toLocaleLowerCase() !== name.trim().toLocaleLowerCase()) return item;
    found = true;
    return { ...row, id, active: false };
  });
  if (!found) throw new Error("ไม่พบข้อมูลพนักงานที่ต้องการลบ กรุณารีเฟรชรายชื่อ");
  return updated;
}

export function editEngineerRecords(records: unknown[], sourceId: string, name: string, fields: { name: string; phone: string | null; position: string | null; avatar_url: string | null }) {
  let found = false;
  const updated = records.map(item => {
    const row = typeof item === "string" ? { name: item.trim() } : item;
    if (!row || typeof row !== "object" || !("name" in row)) return item;
    const id = "id" in row ? String(row.id) : String(row.name);
    if (id !== sourceId || ("active" in row && row.active === false)) return item;
    found = true;
    return { ...row, ...fields, id };
  });
  if (!found) throw new Error(`ไม่พบข้อมูล ${name} กรุณารีเฟรชรายชื่อ`);
  return updated;
}