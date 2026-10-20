import { useEffect, useState } from "react";
import { findChecklistTemplate, loadTemplates, type ChecklistTemplate } from "@/lib/checklist";

export function PumpTypeChecklist({ pumpType }: { pumpType: string }) {
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    void loadTemplates().then((list) => { if (active) setTemplates(list); }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, []);
  const template = findChecklistTemplate(templates, pumpType);
  return <div className="min-w-0 space-y-1 lg:col-span-2">
    <p className="text-sm font-medium">Checklist ประจำประเภทปั๊ม: {template?.name ?? (error ? "โหลดไม่สำเร็จ" : "ยังไม่มีชุดที่ผูกไว้")}</p>
    {template && <ul className="grid min-w-0 grid-cols-1 gap-1 text-sm text-muted-foreground lg:grid-cols-2">
      {template.items.map((item) => <li key={item.id} className="break-words">• {item.label}</li>)}
    </ul>}
  </div>;
}