import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { BarChart3, Camera, FileDown, Loader2, Pencil } from "lucide-react";
import { splitNames } from "@/components/ui/multi-combobox";
import { elementToPdfBlobPaged, formatDate, saveFile } from "@/lib/report";
import { useAccess } from "@/lib/access";
import { logAudit } from "@/lib/audit";
import { DateInput } from "@/components/ui/date-input";

type Row = {
  id: string;
  customer_name: string | null;
  job_detail: string | null;
  staff_name: string | null;
  sales_rep: string | null;
  vehicle_plate: string | null;
  serial_number: string | null;
  customer_sn: string | null;
  visit_date: string;
  visit_time: string | null;
  status: string;
  result: string | null;
  close_note: string | null;
  quotation_required: boolean | null;
  parts_categories: string | null;
  parts_note: string | null;
  parts_replaced: string | null;
  quotation_items: string | null;
};

const iso = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** ช่วงวันที่ตามมุมมองที่เลือก */
function rangeFor(mode: "day" | "week" | "month", day: string) {
  const d = new Date(day + "T00:00:00");
  if (mode === "day") return { from: day, to: day };
  if (mode === "week") {
    const dow = (d.getDay() + 6) % 7; // จันทร์ = 0
    const from = new Date(d);
    from.setDate(d.getDate() - dow);
    const to = new Date(from);
    to.setDate(from.getDate() + 6);
    return { from: iso(from), to: iso(to) };
  }
  return {
    from: iso(new Date(d.getFullYear(), d.getMonth(), 1)),
    to: iso(new Date(d.getFullYear(), d.getMonth() + 1, 0)),
  };
}

/** สรุปใบสั่งงาน: รายวัน/สัปดาห์/เดือน + ช่วงวันที่เอง + ตัวกรอง + แก้ไข + ส่งออก */
export function JobReportsPanel({ onPickDate }: { onPickDate?: (date: string) => void }) {
  const { isAdmin } = useAccess();
  const [mode, setMode] = useState<"day" | "week" | "month" | "custom">("day");
  const [day, setDay] = useState(iso(new Date()));
  const [customFrom, setCustomFrom] = useState(iso(new Date()));
  const [customTo, setCustomTo] = useState(iso(new Date()));
  const [allRows, setAllRows] = useState<Row[]>([]);
  const [snMap, setSnMap] = useState<Record<string, string>>({});
  const [scope, setScope] = useState<"all" | "open" | "closed">("all");
  const [tech, setTech] = useState<string | null>(null);
  const [rep, setRep] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<"none" | "seller" | "tech">("none");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState("");
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("landscape");
  const [editRow, setEditRow] = useState<Row | null>(null);
  const [show, setShow] = useState({ table: true, pending: true, customers: true, workload: true });
  const ref = useRef<HTMLDivElement | null>(null);

  const range = useMemo(
    () => (mode === "custom" ? { from: customFrom, to: customTo } : rangeFor(mode, day)),
    [mode, day, customFrom, customTo],
  );

  const load = useCallback(async () => {
    setLoading(true);
    const [a, m] = await Promise.all([
      supabase
        .from("appointments")
        .select(
          "id, customer_name, job_detail, staff_name, sales_rep, vehicle_plate, serial_number, customer_sn, visit_date, visit_time, status, result, close_note, quotation_required, parts_categories, parts_note, parts_replaced, quotation_items",
        )
        .gte("visit_date", range.from)
        .lte("visit_date", range.to)
        .order("visit_date")
        .order("visit_time"),
      supabase.from("machine_units").select("serial_number, customer_sn"),
    ]);
    const map: Record<string, string> = {};
    for (const u of (m.data ?? []) as { serial_number: string | null; customer_sn: string | null }[]) {
      if (u.serial_number && u.customer_sn) map[u.serial_number.trim().toLowerCase()] = u.customer_sn;
    }
    setSnMap(map);
    setAllRows((a.data ?? []) as Row[]);
    setLoading(false);
  }, [range.from, range.to]);

  useEffect(() => {
    load();
  }, [load]);

  const custSn = useCallback(
    (r: Row) => r.customer_sn || (r.serial_number ? snMap[r.serial_number.trim().toLowerCase()] : "") || "",
    [snMap],
  );

  const techOptions = useMemo(() => {
    const set = new Set<string>();
    allRows.forEach((r) => splitNames(r.staff_name ?? "").forEach((n) => set.add(n)));
    return [...set].sort((a, b) => a.localeCompare(b, "th"));
  }, [allRows]);

  const repOptions = useMemo(() => {
    const set = new Set<string>();
    allRows.forEach((r) => r.sales_rep?.trim() && set.add(r.sales_rep.trim()));
    return [...set].sort((a, b) => a.localeCompare(b, "th"));
  }, [allRows]);

  const rows = useMemo(
    () =>
      allRows.filter((r) => {
        if (scope === "closed" && r.status !== "closed") return false;
        if (scope === "open" && r.status === "closed") return false;
        if (tech && !splitNames(r.staff_name ?? "").includes(tech)) return false;
        if (rep && (r.sales_rep ?? "").trim() !== rep) return false;
        return true;
      }),
    [allRows, scope, tech, rep],
  );

  const tableGroups = useMemo(() => {
    if (groupBy === "none") return [["", rows]] as [string, Row[]][];
    const m = new Map<string, Row[]>();
    rows.forEach((r) => {
      const keys =
        groupBy === "seller" ? [(r.sales_rep ?? "").trim() || "ไม่ระบุเซลล์"] : splitNames(r.staff_name ?? "").length ? splitNames(r.staff_name ?? "") : ["ไม่ระบุช่าง"];
      keys.forEach((k) => m.set(k, [...(m.get(k) ?? []), r]));
    });
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], "th"));
  }, [rows, groupBy]);

  const done = rows.filter((r) => r.status === "closed");
  const pendingRows = rows.filter((r) => r.status !== "closed");
  const notOk = done.filter((r) => r.result === "not_ok").length;

  const workload = useMemo(() => {
    const map = new Map<string, { total: number; done: number }>();
    for (const r of rows) {
      const names = splitNames(r.staff_name ?? "");
      for (const n of names.length ? names : ["ยังไม่ระบุช่าง"]) {
        const cur = map.get(n) ?? { total: 0, done: 0 };
        cur.total += 1;
        if (r.status === "closed") cur.done += 1;
        map.set(n, cur);
      }
    }
    return [...map.entries()].sort((a, b) => b[1].total - a[1].total);
  }, [rows]);

  const grouped = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const r of rows) {
      const key = r.customer_name?.trim() || "ไม่ระบุลูกค้า";
      map.set(key, [...(map.get(key) ?? []), r]);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], "th"));
  }, [rows]);

  const modeLabel =
    mode === "day" ? "รายวัน" : mode === "week" ? "รายสัปดาห์" : mode === "month" ? "รายเดือน" : "ช่วงวันที่";
  const label = range.from === range.to ? formatDate(range.from) : `${formatDate(range.from)} ถึง ${formatDate(range.to)}`;
  const scopeLabel =
    scope === "open" ? "ก่อนปิดงาน (งานค้าง)" : scope === "closed" ? "หลังปิดงาน (ปิดแล้ว)" : "ทุกสถานะ";

  /** อะไหล่ที่เปลี่ยนจริงในงาน */
  const replacedParts = (r: Row) => {
    const details = [r.parts_replaced, r.parts_categories, r.parts_note]
      .map((value) => value?.trim())
      .filter(Boolean);
    return details.length ? [...new Set(details)].join(" · ") : "-";
  };

  /** รายการที่ต้องเสนอราคาเพิ่มเติม */
  const quotationItems = (r: Row) => {
    const items = r.quotation_items?.trim();
    if (items) return items;
    return r.quotation_required ? "ต้องเสนอราคาเพิ่มเติม" : "-";
  };

  const visibleCount = Object.values(show).filter(Boolean).length;

  const workStatus = (r: Row) =>
    r.status === "closed" ? (r.result === "not_ok" ? "ปิดงานไม่เรียบร้อย" : "เสร็จสมบูรณ์") : "ยังไม่เสร็จ";

  /** เครื่องคำนวณเลย์เอาต์อัตโนมัติ: ย่อ/ขยายขนาดตัวอักษรและระยะห่างให้พอดีหน้ากระดาษ */
  const fitScale = (el: HTMLElement, pageHeight: number) => {
    el.style.setProperty("--jr-scale", "1");
    el.getBoundingClientRect();
    const h = el.scrollHeight;
    if (h <= pageHeight) {
      // เนื้อหาน้อย: ขยายเล็กน้อยให้เต็มหน้า แต่ไม่เกิน 1.25 เท่า
      const up = Math.min(1.25, Math.max(1, (pageHeight / Math.max(h, 1)) * 0.92));
      el.style.setProperty("--jr-scale", up.toFixed(3));
      return;
    }
    const pages = Math.ceil(h / pageHeight);
    const scale = Math.max(0.82, Math.min(1, (pages * pageHeight * 0.96) / h));
    el.style.setProperty("--jr-scale", scale.toFixed(3));
  };

  const exportReport = async (kind: "image" | "pdf") => {
    const el = ref.current;
    if (!el) return;
    setExporting(kind);
    el.classList.add("job-report-export", `job-report-export--${orientation}`);
    try {
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      const pageHeight = orientation === "landscape" ? 794 : 1123;
      fitScale(el, pageHeight);
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      if (kind === "pdf") {
        const exportWidth = orientation === "landscape" ? 1123 : 794;
        const blob = await elementToPdfBlobPaged(el, 0, {
          orientation,
          size: { width: exportWidth, height: el.scrollHeight },
          pixelRatio: 3,
          maxBytes: 12 * 1024 * 1024,
          pageBreakSelector: ".job-report-table tbody tr",
        });
        await saveFile(blob, `สรุปใบสั่งงาน-${scopeLabel}-${range.from}.pdf`);
      } else {
        const { toPng } = await import("html-to-image");
        const dataUrl = await toPng(el, {
          backgroundColor: "#ffffff",
          cacheBust: true,
          pixelRatio: 3,
          width: el.scrollWidth,
          height: el.scrollHeight,
        });
        const blob = await (await fetch(dataUrl)).blob();
        await saveFile(blob, `สรุปใบสั่งงาน-${scopeLabel}-${range.from}.png`);
      }
      toast.success("บันทึกรายงานเรียบร้อย");
    } catch (e) {
      toast.error("บันทึกไม่สำเร็จ: " + (e as Error).message);
    } finally {
      el.classList.remove("job-report-export", "job-report-export--portrait", "job-report-export--landscape");
      el.style.removeProperty("--jr-scale");
      setExporting("");
    }
  };

  return (
    <Card>
      <CardHeader className="gap-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="h-4 w-4" /> สรุปใบสั่งงาน
        </CardTitle>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1">
            {([
              ["day", "รายวัน"],
              ["week", "รายสัปดาห์"],
              ["month", "รายเดือน"],
              ["custom", "เลือกช่วงวันที่"],
            ] as const).map(([k, t]) => (
              <Button key={k} size="sm" variant={mode === k ? "default" : "outline"} onClick={() => setMode(k)}>
                {t}
              </Button>
            ))}
          </div>

          <div className="flex flex-wrap gap-1">
            {([
              ["all", "ทุกสถานะ"],
              ["open", "ก่อนบริการ"],
              ["closed", "หลังบริการ"],
            ] as const).map(([k, t]) => (
              <Button key={k} size="sm" variant={scope === k ? "default" : "outline"} onClick={() => setScope(k)}>
                {t}
              </Button>
            ))}
          </div>

          {mode === "custom" ? (
            <div className="flex items-center gap-1">
              <DateInput
                aria-label="ตั้งแต่วันที่"
                className="w-36"
                value={customFrom}
                onChange={(v) => v && setCustomFrom(v)}
              />
              <span className="text-xs text-muted-foreground">ถึง</span>
              <DateInput
                aria-label="ถึงวันที่"
                className="w-36"
                value={customTo}
                onChange={(v) => v && setCustomTo(v)}
              />
            </div>
          ) : (
            <DateInput
              aria-label="เลือกวันที่รายงาน"
              className="w-36"
              value={day}
              onChange={(v) => v && setDay(v)}
            />
          )}

          <div className="ml-auto flex flex-wrap items-center gap-1">
            <div className="flex gap-1" aria-label="แนวกระดาษ">
              <Button
                size="sm"
                variant={orientation === "portrait" ? "default" : "outline"}
                onClick={() => setOrientation("portrait")}
              >
                แนวตั้ง
              </Button>
              <Button
                size="sm"
                variant={orientation === "landscape" ? "default" : "outline"}
                onClick={() => setOrientation("landscape")}
              >
                แนวนอน
              </Button>
            </div>
            <Button size="sm" variant="outline" disabled={!!exporting} onClick={() => exportReport("image")}>
              {exporting === "image" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Camera className="mr-1 h-4 w-4" />}
              PNG
            </Button>
            <Button size="sm" variant="outline" disabled={!!exporting} onClick={() => exportReport("pdf")}>
              {exporting === "pdf" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileDown className="mr-1 h-4 w-4" />}
              PDF
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold text-muted-foreground">แยกรายงาน:</span>
          {([
            ["none", "ดูทั้งหมด"],
            ["seller", "แยกตามผู้ขาย/เซลล์"],
            ["tech", "แยกตามช่าง"],
          ] as const).map(([k, l]) => (
            <Button key={k} size="sm" variant={groupBy === k ? "default" : "outline"} onClick={() => setGroupBy(k)}>
              {l}
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">ช่าง:</span>
          <Button size="sm" variant={tech === null ? "default" : "outline"} onClick={() => setTech(null)}>
            ทั้งหมด
          </Button>
          {techOptions.map((t) => (
            <Button key={t} size="sm" variant={tech === t ? "default" : "outline"} onClick={() => setTech(t)}>
              {t}
            </Button>
          ))}
          <span className="ml-2 text-muted-foreground">เซลล์:</span>
          <Button size="sm" variant={rep === null ? "default" : "outline"} onClick={() => setRep(null)}>
            ทั้งหมด
          </Button>
          {repOptions.map((t) => (
            <Button key={t} size="sm" variant={rep === t ? "default" : "outline"} onClick={() => setRep(t)}>
              {t}
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 p-2 text-xs">
          <span className="text-muted-foreground">แสดงส่วน:</span>
          {([
            ["table", "ตารางงาน"],
            ["pending", "งานที่ยังค้าง"],
            ["customers", "สรุปตามลูกค้า"],
            ["workload", "ภาระงานรายช่าง"],
          ] as const).map(([k, t]) => (
            <label key={k} className="flex cursor-pointer items-center gap-1.5">
              <Checkbox
                checked={show[k]}
                onCheckedChange={(v) => setShow((s) => ({ ...s, [k]: v === true }))}
                aria-label={t}
              />
              <span>{t}</span>
            </label>
          ))}
        </div>
      </CardHeader>

      <CardContent>
        <div
          ref={ref}
          data-sections={visibleCount}
          className={`job-report bg-card p-1 ${visibleCount <= 2 ? "space-y-6" : "space-y-4"}`}
        >
          <p className="text-sm font-semibold">
            สรุปใบสั่งงาน {modeLabel} · {label} · {scopeLabel}
            {tech ? ` · ช่าง ${tech}` : ""}
            {rep ? ` · เซลล์ ${rep}` : ""}
            {groupBy === "seller" ? " · แยกตามเซลล์" : groupBy === "tech" ? " · แยกตามช่าง" : ""}
          </p>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Metric label="งานทั้งหมด" value={rows.length} />
            <Metric label="ปิดงานแล้ว" value={done.length} tone="ok" />
            <Metric label="ค้างอยู่" value={pendingRows.length} tone="warn" />
            <Metric label="ปิดงานไม่เรียบร้อย" value={notOk} tone="bad" />
          </div>

          {show.table && (
          <div className="job-report-table-wrap overflow-x-auto">
            <table className="job-report-table w-full min-w-[1100px] border-collapse text-xs">
              <thead>
                <tr className="bg-muted/50 text-left">
                  {[
                    "ชื่อลูกค้า",
                    "S/N หลัก",
                    "S/N ลูกค้า",
                    "งานที่ได้รับมอบหมาย",
                    "งานที่ดำเนินการ",
                    "อะไหล่ที่เปลี่ยน",
                    "รายการเสนอราคาเพิ่มเติม",
                    "ชื่อช่าง",
                    "รถ",
                    "สถานะงาน",
                  ].map((h) => (
                    <th key={h} className="border px-2 py-1 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="border px-2 py-2 text-muted-foreground" colSpan={10}>
                      กำลังโหลด...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td className="border px-2 py-2 text-muted-foreground" colSpan={10}>
                      ไม่มีข้อมูลในช่วงนี้
                    </td>
                  </tr>
                ) : (
                  tableGroups.map(([g, list]) => (
                  <Fragment key={g || "all"}>
                    {g && (
                      <tr className="bg-muted/60">
                        <td className="border px-2 py-1 font-bold" colSpan={10}>
                          {groupBy === "seller" ? "เซลล์" : "ช่าง"}: {g} — {list.length} งาน (ค้าง {list.filter((x) => x.status !== "closed").length})
                        </td>
                      </tr>
                    )}
                  {list.map((r) => (
                    <tr key={g + r.id} className="align-top">
                      <td className="border px-2 py-1 font-semibold">
                        <button type="button" className="text-left" onClick={() => onPickDate?.(r.visit_date)}>
                          {r.customer_name || "-"}
                          <span className="block font-normal text-muted-foreground">{formatDate(r.visit_date)}</span>
                        </button>
                      </td>
                      <td className="border px-2 py-1 font-mono">{r.serial_number || "-"}</td>
                      <td className="border px-2 py-1 font-mono font-semibold">{custSn(r) || "-"}</td>
                      <td className="border px-2 py-1">{r.job_detail || "-"}</td>
                      <td className="border px-2 py-1">{r.close_note || (r.status === "closed" ? "ปิดงานแล้ว" : "-")}</td>
                      <td className="border px-2 py-1">{replacedParts(r)}</td>
                      <td className="border px-2 py-1">{quotationItems(r)}</td>
                      <td className="border px-2 py-1">{r.staff_name || "-"}</td>
                      <td className="border px-2 py-1">{r.vehicle_plate || "-"}</td>
                      <td className="border px-2 py-1">
                        <span>{workStatus(r)}</span>
                        {isAdmin && (
                          <Button size="sm" variant="outline" className="no-print mt-1 h-7 px-2" onClick={() => setEditRow(r)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                  </Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
          )}

          {show.pending && (
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground">งานที่ยังค้าง (กดเพื่อไปยังวันนั้น)</p>
            {pendingRows.length === 0 ? (
              <p className="text-xs text-muted-foreground">ไม่มีงานค้าง 🎉</p>
            ) : (
              <ul
                className="space-y-1 overflow-y-auto scrollbar-none"
                style={{ maxHeight: visibleCount <= 2 ? 520 : 224 }}
              >
                {pendingRows.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => onPickDate?.(r.visit_date)}
                      className="w-full rounded-lg border p-2 text-left text-xs hover:bg-accent/50"
                    >
                      <span className="font-semibold">{r.customer_name || "-"}</span>{" "}
                      <span className="text-muted-foreground">
                        {formatDate(r.visit_date)} {r.visit_time?.slice(0, 5) ?? ""}
                      </span>
                      <span className="block truncate text-muted-foreground">{r.job_detail || "-"}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          )}

          {show.customers && (
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground">สรุปงานแยกตามลูกค้า</p>
            {grouped.length === 0 ? (
              <p className="text-xs text-muted-foreground">ยังไม่มีข้อมูล</p>
            ) : (
              <div className="space-y-2">
                {grouped.map(([customer, list]) => (
                  <div key={customer} className="rounded-lg border p-2">
                    <p className="text-sm font-semibold">{customer}</p>
                    <ul className="mt-1 space-y-1 text-xs">
                      {list.map((r) => (
                        <li key={r.id} className="flex flex-wrap gap-1">
                          <span>{r.job_detail || "-"}</span>
                          <Badge variant={r.status === "closed" ? "secondary" : "outline"}>
                            {r.status === "closed" ? "เสร็จสมบูรณ์" : "ยังไม่เสร็จ"}
                          </Badge>
                          {custSn(r) && <span className="font-mono">S/N ลูกค้า: {custSn(r)}</span>}
                          {r.quotation_required && <span>· ต้องเสนอราคา</span>}
                          <span className="text-muted-foreground">· ช่าง {r.staff_name || "-"}</span>
                          {r.sales_rep && <span className="text-muted-foreground">· เซลล์ {r.sales_rep}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
          )}

          {show.workload && (
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground">ภาระงานรายช่าง</p>
            <div className="flex flex-wrap gap-2">
              {workload.map(([name, v]) => (
                <Badge key={name} variant="outline">
                  {name}: {v.done}/{v.total}
                </Badge>
              ))}
              {workload.length === 0 && <p className="text-xs text-muted-foreground">ยังไม่มีข้อมูล</p>}
            </div>
          </div>
          )}

          {visibleCount === 0 && (
            <p className="text-xs text-muted-foreground">เลือกอย่างน้อยหนึ่งส่วนด้านบนเพื่อแสดงข้อมูล</p>
          )}
        </div>
      </CardContent>

      <EditJobDialog row={editRow} onClose={() => setEditRow(null)} onSaved={load} />
    </Card>
  );
}

function EditJobDialog({ row, onClose, onSaved }: { row: Row | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<Row | null>(row);
  const [saving, setSaving] = useState(false);
  useEffect(() => setForm(row), [row]);
  if (!form) return null;

  const set = (k: keyof Row, v: string | boolean | null) => setForm({ ...form, [k]: v } as Row);

  const save = async () => {
    setSaving(true);
    const payload = {
      customer_name: form.customer_name,
      job_detail: form.job_detail,
      close_note: form.close_note,
      staff_name: form.staff_name,
      vehicle_plate: form.vehicle_plate,
      sales_rep: form.sales_rep,
      serial_number: form.serial_number,
      customer_sn: form.customer_sn,
      quotation_required: !!form.quotation_required,
    };
    const { error } = await supabase.from("appointments").update(payload).eq("id", form.id);
    setSaving(false);
    if (error) return toast.error("บันทึกไม่สำเร็จ: " + error.message);
    await logAudit({
      table: "appointments",
      recordId: form.id,
      action: "update",
      summary: `แก้ไขใบสั่งงานของ ${form.customer_name ?? "-"} (${formatDate(form.visit_date)})`,
      changes: payload,
    });
    toast.success("บันทึกแล้ว");
    onSaved();
    onClose();
  };

  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-none overflow-y-auto sm:w-[calc(100vw-2rem)]">
        <DialogHeader>
          <DialogTitle>แก้ไขใบสั่งงาน</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="ลูกค้า" value={form.customer_name} onChange={(v) => set("customer_name", v)} />
          <Field label="ช่าง" value={form.staff_name} onChange={(v) => set("staff_name", v)} />
          <Field label="S/N เครื่อง" value={form.serial_number} onChange={(v) => set("serial_number", v)} />
          <Field label="S/N ลูกค้า" value={form.customer_sn} onChange={(v) => set("customer_sn", v)} />
          <Field label="ทะเบียนรถ" value={form.vehicle_plate} onChange={(v) => set("vehicle_plate", v)} />
          <Field label="เซลล์" value={form.sales_rep} onChange={(v) => set("sales_rep", v)} />
          <div className="sm:col-span-2">
            <Label>งานที่ต้องทำ</Label>
            <Textarea value={form.job_detail ?? ""} onChange={(e) => set("job_detail", e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label>งานที่ทำจริง / บันทึกปิดงาน</Label>
            <Textarea value={form.close_note ?? ""} onChange={(e) => set("close_note", e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={!!form.quotation_required}
              onChange={(e) => set("quotation_required", e.target.checked)}
            />
            ต้องเสนอราคาต่อ
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} บันทึก
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone?: "ok" | "warn" | "bad" }) {
  const color =
    tone === "ok"
      ? "text-emerald-600"
      : tone === "warn"
        ? "text-amber-600"
        : tone === "bad"
          ? "text-destructive"
          : "";
  return (
    <div className="rounded-lg border p-2 text-center">
      <p className={"text-lg font-bold " + color}>{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
