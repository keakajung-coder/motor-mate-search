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
      <div className="flex flex-wrap items-center gap-2 text-sm">
        การตรวจเช็คครั้งที่
        <Input className="h-8 w-16" inputMode="numeric" value={value.check_no} onChange={(e) => onChange({ ...value, check_no: e.target.value })} />
        ปี
        <Input className="h-8 w-20" inputMode="numeric" value={value.year} onChange={(e) => onChange({ ...value, year: e.target.value })} />
      </div>
      {numeric.length > 0 && (
        <div className="space-y-1.5">
          {numeric.map(({ it, i }) => (
            <div key={it.id} className="flex flex-col gap-1 sm:flex-row sm:items-center">
              <span className="text-sm sm:w-56 sm:shrink-0">{it.label}</span>
               <div className="flex min-w-0 flex-1 flex-wrap gap-2">{valueInputs(it, i)}</div>
            </div>
          ))}
        </div>
      )}
      {statuses.length > 0 && (
        <div className="space-y-1.5 border-t pt-2">
          {statuses.map(({ it, i }) => (
            <div key={it.id} className="flex flex-col gap-1 sm:flex-row sm:items-center">
              <span className="text-sm sm:w-56 sm:shrink-0">{it.label}</span>
              <div className="flex flex-wrap gap-1">
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setItem(i, { status: it.status === s ? null : s })}
                    className={cn(
                      "rounded border px-2 py-0.5 text-xs",
                      it.status === s
                        ? s === "normal" ? "border-primary bg-primary text-primary-foreground"
                          : s === "replace" ? "border-secondary-foreground bg-secondary"
                          : "border-destructive bg-destructive text-destructive-foreground"
                        : "bg-background",
                    )}
                  >
                    {STATUS_LABEL[s]}
                  </button>
                ))}
              </div>
               {it.kind === "status_number" && <div className="flex min-w-0 flex-1 flex-wrap gap-2">{valueInputs(it, i)}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
