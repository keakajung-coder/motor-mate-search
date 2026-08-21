import * as React from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
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
}: {
  values: string[];
  onChange: (v: string[]) => void;
  options: string[];
  placeholder?: string;
  searchPlaceholder?: string;
  allowCustom?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const q = query.trim();
  const all = Array.from(new Set([...options, ...values])).filter(Boolean);
  const exists = all.some((o) => o.toLowerCase() === q.toLowerCase());

  const toggle = (name: string) => {
    const hit = values.some((v) => v.toLowerCase() === name.toLowerCase());
    onChange(hit ? values.filter((v) => v.toLowerCase() !== name.toLowerCase()) : [...values, name]);
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
            "h-auto min-h-11 w-full justify-between whitespace-normal py-2 text-left font-normal",
            values.length === 0 && "text-muted-foreground",
            className,
          )}
        >
          <span className="flex flex-wrap gap-1">
            {values.length === 0 ? (
              placeholder
            ) : (
              values.map((v) => (
                <Badge key={v} variant="secondary" className="gap-1">
                  {v}
                  <X
                    className="h-3 w-3"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!disabled) toggle(v);
                    }}
                  />
                </Badge>
              ))
            )}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command filter={(val, search) => (val.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}>
          <CommandInput placeholder={searchPlaceholder} value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty className="px-3 py-3 text-sm text-muted-foreground">ไม่พบข้อมูล</CommandEmpty>
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
