import { useState } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { addTag, parseTags, removeTag } from "@/lib/parts-search";

/**
 * ช่องกรอกแบบ Multi-tag — พิมพ์แล้วกด Enter (หรือวางหลายค่าคั่นด้วย , ;) เพื่อเพิ่มรายการ
 */
export function TagInput({
  value,
  onChange,
  placeholder,
  "aria-label": ariaLabel,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  "aria-label"?: string;
}) {
  const [draft, setDraft] = useState("");

  const commit = (raw: string) => {
    const tags = parseTags(raw);
    if (tags.length === 0) return;
    let next = value;
    for (const t of tags) next = addTag(next, t);
    onChange(next);
    setDraft("");
  };

  return (
    <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border bg-background px-2 py-1.5 focus-within:ring-2 focus-within:ring-ring">
      {value.map((tag) => (
        <Badge key={tag} variant="secondary" className="gap-1 font-mono text-xs">
          {tag}
          <button
            type="button"
            aria-label={`ลบ ${tag}`}
            className="rounded-full hover:text-destructive"
            onClick={() => onChange(removeTag(value, tag))}
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <Input
        value={draft}
        aria-label={ariaLabel}
        placeholder={value.length === 0 ? placeholder : ""}
        className="h-7 min-w-[8rem] flex-1 border-0 px-1 py-0 shadow-none focus-visible:ring-0"
        onChange={(e) => {
          const v = e.target.value;
          if (/[,;\n]/.test(v)) commit(v);
          else setDraft(v);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit(draft);
          } else if (e.key === "Backspace" && !draft && value.length > 0) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={() => commit(draft)}
      />
    </div>
  );
}
