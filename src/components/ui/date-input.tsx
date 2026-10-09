import * as React from "react";
import { CalendarDays } from "lucide-react";
import { th } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  const [open, setOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const calendarId = React.useId();
  const selected = React.useMemo(() => {
    const iso = parseDateText(value ?? "");
    return iso ? new Date(`${iso}T00:00:00`) : undefined;
  }, [value]);
  const [month, setMonth] = React.useState<Date | undefined>(selected);

  React.useEffect(() => {
    setText(toBEDisplay(value));
    setBad(false);
  }, [value]);

  React.useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  const commit = () => {
    const iso = parseDateText(text);
    if (iso === null) return setBad(true);
    setBad(false);
    if (iso !== (value ?? "")) onChange(iso);
    else setText(toBEDisplay(value));
  };

  const changeOpen = (next: boolean) => {
    if (disabled) return;
    if (next) setMonth(selected ?? new Date());
    setOpen(next);
  };

  return (
    <Popover open={open && !disabled} onOpenChange={changeOpen}>
    <PopoverAnchor asChild>
    <div data-readonly-allow className={cn("relative min-w-0 w-full", className)}>
      <input
        ref={inputRef}
        id={id}
        type="text"
        inputMode="numeric"
        aria-label={rest["aria-label"]}
        aria-haspopup="dialog"
        aria-expanded={open && !disabled}
        aria-controls={open ? calendarId : undefined}
        aria-invalid={bad}
        disabled={disabled}
        value={text}
        placeholder="วว-ดด-ปปปป (พ.ศ./ค.ศ.)"
        onChange={(e) => setText(e.target.value)}
        onClick={() => changeOpen(true)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
            setOpen(false);
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            changeOpen(true);
          } else if (e.key === "Escape" && open) {
            e.stopPropagation();
            setOpen(false);
          }
        }}
        title={bad ? "รูปแบบวันที่ไม่ถูกต้อง เช่น 27-09-2569 หรือ 27/09/2026" : undefined}
        className={cn(
          "flex min-w-0 w-full rounded-md border border-input bg-background pl-3 pr-9 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
          size === "sm" ? "h-8 text-xs" : "h-10 text-sm",
          bad && "border-destructive",
        )}
      />
      <PopoverTrigger asChild>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={disabled}
        aria-label="เลือกจากปฏิทิน"
        title="เลือกจากปฏิทิน"
        className="absolute right-0 top-0 h-full w-9 rounded-l-none p-0 text-muted-foreground"
      >
        <CalendarDays className="h-4 w-4" />
      </Button>
      </PopoverTrigger>
    </div>
    </PopoverAnchor>
    <PopoverContent
      id={calendarId}
      aria-label="เลือกวันที่"
      data-readonly-allow
      align="start"
      sideOffset={6}
      collisionPadding={8}
      avoidCollisions
      className="date-picker-popover pointer-events-auto p-0"
      onOpenAutoFocus={(event) => event.preventDefault()}
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        inputRef.current?.focus({ preventScroll: true });
      }}
    >
      <Calendar
        mode="single"
        locale={th}
        selected={selected}
        month={month}
        onMonthChange={setMonth}
        captionLayout="dropdown"
        startMonth={new Date(1900, 0)}
        endMonth={new Date(2100, 11)}
        formatters={{ formatYearDropdown: (date) => String(date.getFullYear() + 543) }}
        className="pointer-events-auto w-full p-3"
        onSelect={(date) => {
          if (!date) return;
          const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
          setText(toBEDisplay(iso));
          setBad(false);
          onChange(iso);
          setOpen(false);
        }}
      />
    </PopoverContent>
    </Popover>
  );
}
