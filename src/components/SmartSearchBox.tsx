import { useMemo, useRef, useState } from "react";
import { Search, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";

export type SmartSuggestion = {
  id: string;
  label: string;
  sub?: string;
  onSelect: () => void;
};

/**
 * ช่องค้นหาอัจฉริยะ
 * - พิมพ์แล้วเด้งรายการที่มีอยู่เดิมให้กดเลือกได้ทันที
 * - ถ้าไม่มีข้อมูลเดิม จะมีปุ่มส่งคำที่พิมพ์ไปกรอกในฟอร์ม "เพิ่มข้อมูลใหม่" อัตโนมัติ
 */
export function SmartSearchBox({
  value,
  onChange,
  placeholder,
  suggestions,
  onCreate,
  createLabel = "เพิ่มเป็นข้อมูลใหม่",
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  suggestions: SmartSuggestion[];
  onCreate?: (text: string) => void;
  createLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const kw = value.trim().toLowerCase();

  const matched = useMemo(() => {
    if (!kw) return [];
    return suggestions
      .filter((s) => `${s.label} ${s.sub ?? ""}`.toLowerCase().includes(kw))
      .slice(0, 50);
  }, [suggestions, kw]);

  const exact = matched.some((s) => s.label.trim().toLowerCase() === kw);
  const show = open && kw.length > 0;

  return (
    <div className={"relative " + (className ?? "")}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        className="pl-9"
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          blurTimer.current = setTimeout(() => setOpen(false), 150);
        }}
      />
      {show && (
        <div
          className="dropdown-scroll absolute z-[99999] mt-1 !max-h-[200px] w-full !overflow-y-scroll overflow-x-hidden rounded-lg border bg-popover p-1 shadow-xl"
          style={{ maxHeight: "200px", overflowY: "scroll" }}
          onMouseDown={() => blurTimer.current && clearTimeout(blurTimer.current)}
        >
          {matched.map((s) => (
            <button
              key={s.id}
              type="button"
              className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-accent"
              onClick={() => {
                s.onSelect();
                setOpen(false);
              }}
            >
              <span className="block truncate font-medium">{s.label}</span>
              {s.sub && <span className="block truncate text-xs text-muted-foreground">{s.sub}</span>}
            </button>
          ))}
          {matched.length === 0 && (
            <div className="px-3 py-2 text-xs text-muted-foreground">ไม่พบข้อมูลเดิมในระบบ</div>
          )}
          {onCreate && !exact && (
            <button
              type="button"
              className="mt-1 flex w-full items-center gap-2 rounded-md border-t px-3 py-2 text-left text-sm font-medium text-primary hover:bg-accent"
              onClick={() => {
                onCreate(value.trim());
                setOpen(false);
              }}
            >
              <Plus className="h-4 w-4" /> {createLabel} “{value.trim()}”
            </button>
          )}
        </div>
      )}
    </div>
  );
}
