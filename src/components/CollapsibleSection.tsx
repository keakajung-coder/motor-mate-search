import { useState, type ReactNode } from "react";
import { ChevronDown, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * กล่องข้อมูลแบบพับเก็บได้ (ค่าเริ่มต้น = พับปิดไว้)
 * มีปุ่ม "ดูเพิ่มเติม / ซ่อนข้อมูล" ทั้งหัวแถวและท้ายแถว
 */
export function CollapsibleSection({
  title,
  subtitle,
  defaultOpen = false,
  children,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={"rounded-xl border bg-card " + (className ?? "")}>
      <button
        type="button"
        data-readonly-allow
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left hover:bg-accent/40"
      >
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{title}</span>
          {subtitle && <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>}
        </span>
        <span className="no-print flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
          {open ? "ซ่อนข้อมูล" : "👁️ ดูเพิ่มเติม"}
          <ChevronDown className={"h-4 w-4 transition-transform " + (open ? "rotate-180" : "")} />
        </span>
      </button>
      {open && (
        <div className="space-y-3 border-t p-3">
          {children}
          <div className="no-print flex justify-end">
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              <EyeOff className="mr-1 h-4 w-4" /> ซ่อนข้อมูล
            </Button>
          </div>
        </div>
      )}
      {!open && (
        <div className="no-print flex justify-end px-3 pb-2">
          <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
            <Eye className="mr-1 h-4 w-4" /> ดูเพิ่มเติม
          </Button>
        </div>
      )}
    </div>
  );
}
