import { Input } from "@/components/ui/input";
import { STATUS_LABEL, type ChecklistResult, type ChecklistStatus } from "@/lib/checklist";
import { cn } from "@/lib/utils";

const STATUSES: ChecklistStatus[] = ["normal", "replace", "abnormal"];

export function ChecklistForm({ value, onChange }: { value: ChecklistResult; onChange: (v: ChecklistResult) => void }) {
  const setItem = (idx: number, patch: Partial<ChecklistResult["items"][number]>) =>
    onChange({ ...value, items: value.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)) });

  const numeric = value.items.map((it, i) => ({ it, i })).filter(({ it }) => it.kind === "number");
  const statuses = value.items.map((it, i) => ({ it, i })).filter(({ it }) => it.kind !== "number");

  const valueInputs = (it: ChecklistResult["items"][number], i: number) =>
    (it.fields.length ? it.fields : [""]).map((f, fi) => (
      <label key={fi} className="flex min-w-0 flex-1 items-center gap-1">
        {f && <span className="shrink-0 text-xs text-muted-foreground">{f}</span>}
        <Input
          inputMode="decimal"
          className="h-8 min-w-0 w-full"
          value={it.values[fi] ?? ""}
          onChange={(e) => {
            const values = [...it.values];
            values[fi] = e.target.value;
            setItem(i, { values });
          }}
        />
      </label>
    ));

  return (
    <div className="min-w-0 space-y-3 rounded-md border p-3">
      <div className="text-sm font-semibold">{value.template_name}</div>
      <div className="grid min-w-0 grid-cols-1 gap-2 text-sm lg:grid-cols-2">
        <label className="min-w-0">การตรวจเช็คครั้งที่
          <Input className="h-8 w-full" inputMode="numeric" value={value.check_no} onChange={(e) => onChange({ ...value, check_no: e.target.value })} />
        </label>
        <label className="min-w-0">ปี
          <Input className="h-8 w-full" inputMode="numeric" value={value.year} onChange={(e) => onChange({ ...value, year: e.target.value })} />
        </label>
      </div>
      {numeric.length > 0 && (
        <div className="space-y-1.5">
          {numeric.map(({ it, i }) => (
            <div key={it.id} className="flex min-w-0 flex-col gap-1 xl:flex-row xl:items-center">
              <span className="text-sm xl:w-40 xl:shrink-0">{it.label}</span>
              <div className="flex min-w-0 flex-1 flex-col gap-2 lg:flex-row">{valueInputs(it, i)}</div>
            </div>
          ))}
        </div>
      )}
      {statuses.length > 0 && (
        <div className="space-y-1.5 border-t pt-2">
          {statuses.map(({ it, i }) => (
            <div key={it.id} className="flex min-w-0 flex-col gap-1 xl:flex-row xl:items-center">
              <span className="text-sm xl:w-40 xl:shrink-0">{it.label}</span>
              <div className="flex flex-wrap gap-1">
                {STATUSES.map((s) => {
                  const isSelected = it.status === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setItem(i, { status: isSelected ? null : s })}
                      className={cn(
                        "rounded-lg border px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer",
                        isSelected
                          ? s === "normal"
                            ? "border-emerald-600 bg-emerald-600 text-white shadow-xs"
                            : s === "replace"
                              ? "border-amber-600 bg-amber-500 text-white shadow-xs"
                              : "border-rose-600 bg-rose-600 text-white shadow-xs"
                          : "bg-background text-muted-foreground hover:bg-muted/60 border-border",
                      )}
                    >
                      {s === "normal"
                        ? "✓ ผ่าน (ปกติ)"
                        : s === "replace"
                          ? "⚠️ ควรเฝ้าระวัง"
                          : "⚡ ต้องแก้ไข"}
                    </button>
                  );
                })}
              </div>
              {it.kind === "status_number" && (
                <div className="flex min-w-0 flex-1 flex-col gap-2 lg:flex-row">{valueInputs(it, i)}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
