import * as React from "react";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

/** แปลง ISO (ค.ศ.) เป็นข้อความ วว/ดด/ปปปป แบบ พ.ศ. */
export function toBEDisplay(iso: string | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return String(iso);
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y + 543}`;
}

/** แปลงปีในข้อความเป็น พ.ศ. เสมอ (ถ้าเป็น ค.ศ. จะบวก 543) */
export function beYear(year: number): number {
  return year > 2400 ? year : year + 543;
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
 * ช่องกรอกวันที่ที่แสดงผลเป็น พ.ศ. แต่เก็บค่าเป็น ISO (ค.ศ.) เหมือนเดิม
 * ใช้ native date picker ด้านบน เพื่อให้เลือกวันบนมือถือได้สะดวก
 */
export function DateInput({
  value,
  onChange,
  disabled,
  className,
  id,
  size = "default",
  ...rest
}: Props) {
  const text = toBEDisplay(value);
  return (
    <div className={cn("relative w-full", className)}>
      <div
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3",
          size === "sm" ? "h-8 text-xs" : "h-10 text-sm",
          disabled && "opacity-50",
        )}
      >
        <span className={cn("truncate", !text && "text-muted-foreground")}>
          {text || "วว/ดด/ปปปป (พ.ศ.)"}
        </span>
        <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
      </div>
      <input
        id={id}
        type="date"
        aria-label={rest["aria-label"]}
        disabled={disabled}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </div>
  );
}
