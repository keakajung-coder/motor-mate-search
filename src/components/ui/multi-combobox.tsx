import * as React from "react";
import { Check, ChevronsUpDown, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { isValueRemoved, markValueRemoved } from "@/lib/data-sync";

/** แปลงข้อความ "ก, ข" เป็นอาร์เรย์ */
export const splitNames = (v?: string | null): string[] =>
  (v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

export const joinNames = (list: string[]): string => list.filter(Boolean).join(", ");

/** กล่องตัวเลือกแบบเลือกได้หลายรายการ (ติ๊กเลือก + พิมพ์เพิ่มใหม่ได้) */
export function MultiCombobox({
  values,
  onChange,
  options,
  placeholder = "เลือก...",
  searchPlaceholder = "ค้นหา...",
  allowCustom = true,
  disabled = false,
  className,
  onDelete,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  options: string[];
  placeholder?: string;
  searchPlaceholder?: string;
  allowCustom?: boolean;
  disabled?: boolean;
  className?: string;
  /** แอดมินเท่านั้น: ลบรายการออกจากฐานข้อมูลกลาง */
  onDelete?: (value: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [removed, setRemoved] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    const onRemoved = (e: Event) => {
      const val = (e as CustomEvent)?.detail?.value;
      if (val) setRemoved((prev) => new Set(prev).add(val.trim().toLowerCase()));
    };
    window.addEventListener("app:option-removed", onRemoved);
    return () => window.removeEventListener("app:option-removed", onRemoved);
  }, []);

  const q = query.trim();
  const all = Array.from(new Set([...options, ...values])).filter(
    (o) => Boolean(o) && !removed.has(o.trim().toLowerCase()) && !isValueRemoved(o),
  );
  const exists = all.some((o) => o.toLowerCase() === q.toLowerCase());

  const toggle = (name: string) => {
    const hit = values.some((v) => v.toLowerCase() === name.toLowerCase());
    onChange(
      hit ? values.filter((v) => v.toLowerCase() !== name.toLowerCase()) : [...values, name],
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          disabled={disabled}
          className={cn(
            "h-auto min-h-10 min-w-0 w-full justify-between whitespace-normal py-1.5 px-3 text-left font-normal text-sm",
            values.length === 0 && "text-muted-foreground",
            className,
          )}
        >
          <span className="flex min-w-0 flex-wrap gap-1 overflow-hidden">
            {values.length === 0
              ? placeholder
              : values.map((v) => (
                  <Badge key={v} variant="secondary" className="min-w-0 max-w-full gap-1">
                    <span className="min-w-0 truncate">{v}</span>
                    <X
                      className="h-3 w-3 shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!disabled) toggle(v);
                      }}
                    />
                  </Badge>
                ))}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] min-w-[min(100vw-2rem,280px)] max-w-[calc(100vw-1rem)] p-0 z-[99999]"
        align="start"
        sideOffset={4}
        avoidCollisions
        collisionPadding={8}
      >
        <Command
          filter={(val, search) => (val.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}
        >
          <CommandInput placeholder={searchPlaceholder} value={query} onValueChange={setQuery} />
          <CommandList
            className="!max-h-[200px] !overflow-y-scroll force-scrollbar"
            style={{ maxHeight: "200px", overflowY: "scroll", scrollbarGutter: "stable" }}
          >
            <CommandEmpty className="px-3 py-3 text-sm text-muted-foreground">
              ไม่พบข้อมูล
            </CommandEmpty>
            <CommandGroup>
              {allowCustom && q && !exists && (
                <CommandItem
                  value={q}
                  onSelect={() => {
                    toggle(q);
                    setQuery("");
                  }}
                >
                  <span className="font-medium text-primary">+ เพิ่มรายชื่อใหม่: “{q}”</span>
                </CommandItem>
              )}
              {all.map((o) => {
                const picked = values.some((v) => v.toLowerCase() === o.toLowerCase());
                return (
                  <CommandItem key={o} value={o} onSelect={() => toggle(o)}>
                    <Check className={cn("mr-2 h-4 w-4", picked ? "opacity-100" : "opacity-0")} />
                    <span className="flex-1 truncate">{o}</span>
                    {onDelete && options.some((x) => x === o) && (
                      <button
                        type="button"
                        aria-label="ลบออกจากฐานข้อมูล"
                        title="ลบออกจากฐานข้อมูล (แอดมิน)"
                        className="ml-1 rounded p-1 text-destructive hover:bg-destructive/10"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={async (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (window.confirm(`ลบ "${o}" ออกจากฐานข้อมูลกลาง?`)) {
                            markValueRemoved(o);
                            setRemoved((prev) => new Set(prev).add(o.trim().toLowerCase()));
                            try {
                              await onDelete(o);
                            } catch (err) {
                              console.error(err);
                            }
                            try {
                              const { getQueryClient } = await import("@/lib/query-client");
                              void getQueryClient().invalidateQueries();
                            } catch {
                              /* recover silently */
                            }
                            const target = o.trim().toLowerCase();
                            if (values.some((v) => v.trim().toLowerCase() === target)) {
                              onChange(values.filter((v) => v.trim().toLowerCase() !== target));
                            }
                          }
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
