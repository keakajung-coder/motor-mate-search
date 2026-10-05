import { STATUS_LABEL, type ChecklistResult } from "@/lib/checklist";

/** แสดงผลเช็คลิสต์แบบอ่านอย่างเดียว (ใช้ในรายงานและหน้าดูผลปิดงาน) */
export function ChecklistView({ value }: { value: ChecklistResult | null | undefined }) {
  if (!value || !Array.isArray(value.items) || value.items.length === 0) {
    return <p className="text-xs text-muted-foreground">ไม่มีผลเช็คลิสต์</p>;
  }
  return (
    <div className="min-w-0 space-y-1 text-xs">
      <p className="font-semibold">
        {value.template_name} · การตรวจเช็คครั้งที่ {value.check_no || "-"} ปี {value.year || "-"}
      </p>
      <table className="w-full table-fixed border-collapse">
        <tbody>
          {value.items.map((it) => {
            const vals = (it.values ?? [])
              .map((v, i) => (v ? `${it.fields?.[i] ? it.fields[i] + " " : ""}${v}` : ""))
              .filter(Boolean)
              .join(" / ");
            return (
              <tr key={it.id} className="align-top">
                <td className="w-1/2 break-words border px-2 py-1">{it.label}</td>
                <td className="break-words border px-2 py-1 font-medium">
                  {[it.status ? STATUS_LABEL[it.status] : "", vals].filter(Boolean).join(" · ") || "-"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
