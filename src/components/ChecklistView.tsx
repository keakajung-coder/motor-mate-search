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
              <tr key={it.id} className="align-top border-b">
                <td className="w-1/2 break-words px-2.5 py-1.5">{it.label}</td>
                <td className="break-words px-2.5 py-1.5 font-medium">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {it.status && (
                      <span
                        className={
                          it.status === "normal"
                            ? "rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-300 px-2 py-0.5 text-[11px] font-semibold"
                            : it.status === "replace"
                              ? "rounded-md bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-300 px-2 py-0.5 text-[11px] font-semibold"
                              : "rounded-md bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-300 px-2 py-0.5 text-[11px] font-semibold"
                        }
                      >
                        {STATUS_LABEL[it.status] || it.status}
                      </span>
                    )}
                    {vals && (
                      <span className="font-mono text-foreground font-semibold">
                        {vals}
                      </span>
                    )}
                    {!it.status && !vals && <span className="text-muted-foreground">-</span>}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
