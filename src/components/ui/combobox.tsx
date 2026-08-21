import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
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
}: {
  value: string;
  onChange: (v: string, option?: ComboOption) => void;
  options: ComboOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  allowCustom?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const current = options.find((o) => o.value === value);
  const q = query.trim();
  const exists = options.some((o) => o.value.toLowerCase() === q.toLowerCase());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          disabled={disabled}
          className={cn("h-11 w-full justify-between font-normal", !value && "text-muted-foreground", className)}
        >
          <span className="truncate">{value ? current?.label ?? value : placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command
          filter={(val, search) => (val.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}
        >
          <CommandInput placeholder={searchPlaceholder} value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty className="px-3 py-3 text-sm text-muted-foreground">ไม่พบข้อมูล</CommandEmpty>
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
              {options.map((o) => (
                <CommandItem
                  key={o.value + (o.hint ?? "")}
                  value={`${o.value} ${o.label ?? ""} ${o.hint ?? ""}`}
                  onSelect={() => {
                    onChange(o.value, o);
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === o.value ? "opacity-100" : "opacity-0")} />
                  <span className="flex-1 truncate">
                    {o.label ?? o.value}
                    {o.hint && <span className="ml-2 text-xs text-muted-foreground">{o.hint}</span>}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
