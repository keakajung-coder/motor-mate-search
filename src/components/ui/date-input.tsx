import * as React from "react";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

/** แปลง ISO (ค.ศ.) เป็นข้อความ วว-ดด-ปปปป แบบ พ.ศ. */
export function toBEDisplay(iso: string | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return String(iso);
  return `${String(d).padStart(2, "0")}-${String(m).padStart(2, "0")}-${y + 543}`;
}

/** แปลงปีในข้อความเป็น พ.ศ. เสมอ (ถ้าเป็น ค.ศ. จะบวก 543) */
export function beYear(year: number): number {
  return year > 2400 ? year : year + 543;
}

/** แปลงข้อความ วัน-เดือน-ปี (พ.ศ. หรือ ค.ศ., คั่นด้วย - / . หรือช่องว่าง) เป็น ISO ค.ศ. */
export function parseDateText(text: string): string | null {
  const t = text.trim();
  if (!t) return "";
  let d: number, m: number, y: number;
  const iso = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  } else {
    const p = t.match(/^(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{2,4})$/) ?? t.match(/^(\d{2})(\d{2})(\d{4})$/);
    if (!p) return null;
    [d, m, y] = [Number(p[1]), Number(p[2]), Number(p[3])];
  }
  if (y < 100) y += y >= 40 ? 2500 : 2000; // 2 หลัก: 67 = พ.ศ. 2567, 26 = ค.ศ. 2026
  if (y > 2400) y -= 543; // พ.ศ. → ค.ศ.
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

type Props = {
  value?: string | null;
  onChange: (iso: string) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
  "aria-label"?: string;
  size?: "sm" | "default";
};

/**
 * ช่องวันที่: พิมพ์เองได้ (วว-ดด-ปปปป พ.ศ. หรือ ค.ศ.) หรือกดไอคอนปฏิทินเพื่อเลือก
 * แสดงผลเป็น พ.ศ. แต่เก็บค่าเป็น ISO (ค.ศ.)
 */
export function DateInput({ value, onChange, disabled, className, id, size = "default", ...rest }: Props) {
  const [text, setText] = React.useState(toBEDisplay(value));
  const [bad, setBad] = React.useState(false);
  const pickerRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setText(toBEDisplay(value));
    setBad(false);
  }, [value]);

  const commit = () => {
    const iso = parseDateText(text);
    if (iso === null) return setBad(true);
    setBad(false);
    if (iso !== (value ?? "")) onChange(iso);
    else setText(toBEDisplay(value));
  };

  const openPicker = () => {
    const el = pickerRef.current;
    if (!el) return;
    try {
      el.showPicker();
    } catch {
      el.focus();
      el.click();
    }
  };

  return (
    <div className={cn("relative w-full", className)}>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        aria-label={rest["aria-label"]}
        disabled={disabled}
        value={text}
        placeholder="วว-ดด-ปปปป (พ.ศ./ค.ศ.)"
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
        }}
        title={bad ? "รูปแบบวันที่ไม่ถูกต้อง เช่น 27-09-2569 หรือ 27/09/2026" : undefined}
        className={cn(
          "flex w-full rounded-md border border-input bg-background pl-3 pr-9 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
          size === "sm" ? "h-8 text-xs" : "h-10 text-sm",
          bad && "border-destructive",
        )}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={openPicker}
        aria-label="เลือกจากปฏิทิน"
        className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:bg-accent"
      >
        <CalendarDays className="h-4 w-4" />
      </button>
      <input
        ref={pickerRef}
        type="date"
        tabIndex={-1}
        aria-hidden="true"
        disabled={disabled}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="pointer-events-none absolute bottom-0 right-0 h-0 w-0 opacity-0"
      />
    </div>
  );
}
