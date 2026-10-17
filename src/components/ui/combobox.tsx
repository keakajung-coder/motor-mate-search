import * as React from "react";
import { Check, ChevronsUpDown, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export type ComboOption = { value: string; label?: string; hint?: string };

/** กล่องตัวเลือกค้นหาได้ (Searchable Select) — เลือกจากฐานข้อมูล หรือพิมพ์ค่าใหม่ได้ */
export function Combobox({
  value,
  onChange,
  options,
  placeholder = "เลือก...",
  searchPlaceholder = "ค้นหา...",
  allowCustom = true,
  disabled = false,
  className,
  onDelete,
}: {
  value: string;
  onChange: (v: string, option?: ComboOption) => void;
  options: ComboOption[];
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
  // รายการที่เพิ่งกดลบ — ตัดออกจากตัวเลือกทันที ไม่ต้องรอฐานข้อมูลตอบกลับ
  const [removed, setRemoved] = React.useState<Set<string>>(new Set());
  const visibleOptions = React.useMemo(
    () => options.filter((o) => !removed.has(o.value.trim().toLowerCase())),
    [options, removed],
  );

  const current = visibleOptions.find((o) => o.value === value);
  const q = query.trim();
  const exists = visibleOptions.some((o) => o.value.toLowerCase() === q.toLowerCase());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          disabled={disabled}
          className={cn(
            "h-11 min-w-0 w-full justify-between font-normal",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <span className="min-w-0 truncate">
            {value ? (current?.label ?? value) : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command
          filter={(val, search) => (val.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}
        >
          <CommandInput placeholder={searchPlaceholder} value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty className="px-3 py-3 text-sm text-muted-foreground">
              ไม่พบข้อมูล
            </CommandEmpty>
            <CommandGroup>
              {allowCustom && q && !exists && (
                <CommandItem
                  value={q}
                  onSelect={() => {
                    onChange(q);
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  <span className="font-medium text-primary">+ เพิ่มข้อมูลใหม่: “{q}”</span>
                </CommandItem>
              )}
              {value && (
                <CommandItem
                  value="__clear__ ล้างค่า"
                  onSelect={() => {
                    onChange("");
                    setOpen(false);
                  }}
                >
                  ล้างค่า
                </CommandItem>
              )}
              {visibleOptions.map((o) => (
                <CommandItem
                  key={o.value + (o.hint ?? "")}
                  value={`${o.value} ${o.label ?? ""} ${o.hint ?? ""}`}
                  onSelect={() => {
                    onChange(o.value, o);
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  <Check
                    className={cn("mr-2 h-4 w-4", value === o.value ? "opacity-100" : "opacity-0")}
                  />
                  <span className="flex-1 truncate">
                    {o.label ?? o.value}
                    {o.hint && <span className="ml-2 text-xs text-muted-foreground">{o.hint}</span>}
                  </span>
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
                        if (window.confirm(`ลบ "${o.value}" ออกจากฐานข้อมูลกลาง?`)) {
                          setRemoved((prev) => new Set(prev).add(o.value.trim().toLowerCase()));
                          try {
                            await onDelete(o.value);
                          } catch (err) {
                            console.error(err);
                          }
                          if (
                            value &&
                            value.trim().toLowerCase() === o.value.trim().toLowerCase()
                          ) {
                            onChange("");
                          }
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
