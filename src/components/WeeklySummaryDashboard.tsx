import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { BarChart3, CheckCircle2, ClipboardList, Clock3, FileSpreadsheet, Loader2, RefreshCw, SlidersHorizontal, Wrench, ExternalLink, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { DateInput, toBEDisplay } from "@/components/ui/date-input";
import { weeklySummaryQuery } from "@/lib/weekly-summary-query";
import { bangkokDate, buildWeeklySummary, weekRange, filterSummaryJobs, summaryJobSearch, summaryStage, type JobFilter, type ReportJob } from "@/lib/weekly-summary";
import { summarySheets, type SummaryPalette } from "@/lib/weekly-summary-excel";
import { exportFilename, exportDateLabel } from "@/lib/export-filename";
import { saveFile } from "@/lib/report";
import { toast } from "sonner";

const sections = { kpi: "การ์ดสรุป", technicians: "กราฟงานช่าง", machines: "สถานะเครื่องจักร", backlog: "ตารางงานค้าง" };
const stageLabels = { completed: "เสร็จเรียบร้อย", quoted: "อยู่ระหว่างเสนอราคา", pending: "งานค้าง / ยังไม่ดำเนินการ", active: "กำลังดำเนินการ", all: "งานทั้งหมด" };
const chartColors = ["var(--summary-success)", "var(--summary-info)", "var(--summary-attention)", "var(--chart-2)", "var(--destructive)", "var(--muted-foreground)"];
function palette(): SummaryPalette {
  const color = (token: string) => {
    const canvas = document.createElement("canvas"); canvas.width = 1; canvas.height = 1;
    const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("เตรียมสี Excel ไม่สำเร็จ");
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue(token).trim(); ctx.fillRect(0, 0, 1, 1);
    return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3).map(v => v.toString(16).padStart(2, "0")).join("").toUpperCase();
  };
  return { paper: color("--card"), text: color("--foreground"), border: color("--border"), header: color("--muted"), success: color("--summary-success") };
}
export default function WeeklySummaryDashboard() {
  const { data, isFetching, error } = useSuspenseQuery(weeklySummaryQuery);
  const qc = useQueryClient();
  const [range, setRange] = useState(() => weekRange());
  const [show, setShow] = useState({ kpi: true, technicians: true, machines: true, backlog: true });
  const [drill, setDrill] = useState<JobFilter | null>(null);
  const [controls, setControls] = useState(true);
  const [file, setFile] = useState<{ blob: Blob; filename: string } | null>(null);
  const [fileError, setFileError] = useState(false);
  const valid = Boolean(range.from && range.to && range.from <= range.to);
  const summary = useMemo(() => buildWeeklySummary(data.orders, data.appointments, data.machines, range), [data, range]);
  useEffect(() => {
    const refresh = () => { void qc.invalidateQueries({ queryKey: weeklySummaryQuery.queryKey }); };
    window.addEventListener("app:data-changed", refresh);
    return () => window.removeEventListener("app:data-changed", refresh);
  }, [qc]);
  // Prepare before clicking so iOS retains user activation for file sharing.
  useEffect(() => {
    let cancelled = false; setFile(null); setFileError(false);
    if (valid) void import("@/lib/excel-layout").then(async ({ buildGridWorkbook }) => {
      const blob = await buildGridWorkbook(summarySheets(summary, range, palette()));
      if (!cancelled) setFile({ blob, filename: exportFilename("สรุปรายสัปดาห์", range.from, "xlsx", range.to) });
    }).catch(() => { if (!cancelled) setFileError(true); });
    return () => { cancelled = true; };
  }, [summary, range, valid]);
  const download = () => {
    if (!file || !valid) return;
    void saveFile(file.blob, file.filename).catch(() => toast.error("ดาวน์โหลด Excel ไม่สำเร็จ"));
  };
  const kpis = [
    { stage: "all" as const, label: "งานทั้งหมด", value: summary.counts.total, icon: ClipboardList, color: "text-foreground", bg: "bg-muted" },
    { stage: "completed" as const, label: "เสร็จเรียบร้อย", value: summary.counts.completed, icon: CheckCircle2, color: "text-summary-success", bg: "bg-summary-success/10" },
    { stage: "quoted" as const, label: "อยู่ระหว่างเสนอราคา", value: summary.counts.quoted, icon: FileSpreadsheet, color: "text-summary-info", bg: "bg-summary-info/10" },
    { stage: "pending" as const, label: "งานค้าง / ยังไม่ดำเนินการ", value: summary.counts.pending, icon: Clock3, color: "text-destructive", bg: "bg-destructive/10" },
  ];
  return <div className="min-w-0 space-y-7">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground"><BarChart3 className="size-4" /> รายงานการทำงาน</div><h1 className="text-2xl font-semibold sm:text-3xl">สรุปประชุมรายสัปดาห์</h1><p className="mt-2 text-sm text-muted-foreground">{valid ? exportDateLabel(range.from, range.to) : "กรุณาเลือกช่วงวันที่"}</p></div>
      <Button variant="excel" onClick={download} disabled={!file || !valid || isFetching} className="sm:ml-auto"><FileSpreadsheet /> {fileError ? "เตรียม Excel ไม่สำเร็จ" : !file ? <><Loader2 className="animate-spin" /> กำลังเตรียม Excel</> : "ดาวน์โหลด Excel"}</Button>
    </header>
    <div className="border-y border-border bg-card/60 py-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full min-w-0 sm:w-48"><label className="mb-1.5 block text-xs font-medium" htmlFor="summary-from">เริ่มต้น</label><DateInput id="summary-from" aria-label="วันที่เริ่มต้น" value={range.from} onChange={from => setRange(r => ({ ...r, from }))} /></div>
        <div className="w-full min-w-0 sm:w-48"><label className="mb-1.5 block text-xs font-medium" htmlFor="summary-to">สิ้นสุด</label><DateInput id="summary-to" aria-label="วันที่สิ้นสุด" value={range.to} onChange={to => setRange(r => ({ ...r, to }))} /></div>
        <Button variant="outline" onClick={() => setRange(weekRange())}>สัปดาห์นี้</Button>
        <Button variant="outline" aria-expanded={controls} onClick={() => setControls(v => !v)}><SlidersHorizontal /> ส่วนแสดงผล</Button>
        <Button variant="ghost" size="icon" aria-label="รีเฟรชรายงาน" title="รีเฟรชรายงาน" disabled={isFetching} onClick={() => { void qc.invalidateQueries({ queryKey: weeklySummaryQuery.queryKey }); }}><RefreshCw className={isFetching ? "animate-spin" : ""} /></Button>
      </div>
      {controls && <div className="mt-4 flex flex-wrap gap-x-6 gap-y-3 border-t pt-4">{(Object.keys(sections) as (keyof typeof sections)[]).map(key => <label key={key} className="flex cursor-pointer items-center gap-2.5 text-sm"><Switch aria-label={sections[key]} checked={show[key]} onCheckedChange={value => setShow(s => ({ ...s, [key]: value }))} />{sections[key]}</label>)}</div>}
    </div>
    {!valid ? <p role="alert" className="text-destructive">วันที่สิ้นสุดต้องไม่อยู่ก่อนวันที่เริ่มต้น และต้องเลือกวันที่ทั้งสองช่อง</p> : <>
      {error && <p role="alert" className="text-destructive">อัปเดตรายงานไม่สำเร็จ กำลังแสดงข้อมูลที่โหลดล่าสุด</p>}
      {show.kpi && <section aria-label="การ์ดสรุป" className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 xl:grid-cols-4">{kpis.map(k => <Button key={k.label} variant="outline" onClick={() => setDrill({ kind: "stage", stage: k.stage })} aria-label={`ดูรายการ${k.label}`} className="h-auto min-w-0 items-start justify-between gap-2 whitespace-normal rounded-lg border bg-card p-5 text-left"><div className="min-w-0"><p className="min-h-10 text-sm text-muted-foreground">{k.label}</p><p className={`mt-2 text-4xl font-semibold tabular-nums ${k.color}`}>{k.value.toLocaleString("th-TH")}</p><p className="mt-2 text-xs text-muted-foreground">งาน</p></div><div className={`rounded-md p-2.5 ${k.color} ${k.bg}`}><k.icon className="size-5" /></div></Button>)}</section>}
      {show.kpi && summary.counts.active > 0 && <Button variant="link" onClick={() => setDrill({ kind: "stage", stage: "active" })}>กำลังดำเนินการ {summary.counts.active} งาน <ArrowRight /></Button>}
      {(show.technicians || show.machines) && <div className={`grid min-w-0 gap-8 ${show.technicians && show.machines ? "xl:grid-cols-[1.35fr_1fr]" : "grid-cols-1"}`}>
        {show.technicians && <section aria-label="กระจายงานช่าง" className="min-w-0"><div className="mb-5 flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">กระจายงานช่าง</h2><span className="text-xs text-muted-foreground">{summary.technicians.length} รายชื่อ · งานที่รับผิดชอบ</span></div>{summary.technicians.length ? <div className="force-scrollbar max-h-[560px] overflow-y-auto"><div className="min-w-0" style={{ height: Math.max(280, summary.technicians.length * 46) }}><ResponsiveContainer width="100%" height="100%"><BarChart data={summary.technicians} layout="vertical" margin={{ left: 0, right: 28, top: 5, bottom: 0 }}><CartesianGrid stroke="var(--border)" horizontal={false} /><XAxis type="number" allowDecimals={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis type="category" dataKey="name" width={110} tick={{ fill: "var(--foreground)", fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip cursor={{ fill: "var(--muted)" }} contentStyle={{ background: "var(--popover)", borderColor: "var(--border)", color: "var(--foreground)", borderRadius: 6 }} formatter={(value: number) => [`${value} งาน`, "งานที่รับผิดชอบ"]} /><Bar onClick={entry => { if (typeof entry?.name === "string") setDrill({ kind: "technician", name: entry.name }); }} className="cursor-pointer" dataKey="count" fill="var(--summary-info)" radius={[0, 4, 4, 0]} maxBarSize={24} label={{ position: "right", fill: "var(--foreground)", fontSize: 12 }} isAnimationActive={false} /></BarChart></ResponsiveContainer></div><div className="mt-3 flex flex-wrap gap-2">{summary.technicians.map(t => <Button key={t.name} variant="outline" size="sm" className="h-auto min-h-10 max-w-full whitespace-normal" onClick={() => setDrill({ kind: "technician", name: t.name })}>{t.name} · {t.count} งาน <ArrowRight /></Button>)}</div></div> : <Empty text="ไม่มีงานในช่วงวันที่เลือก" />}</section>}
        {show.machines && <section aria-label="สถานะเครื่องจักร" className="min-w-0"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">สถานะเครื่องจักร</h2><span className="text-xs text-muted-foreground">ทั้งหมดปัจจุบัน · {summary.machineTotal} เครื่อง</span></div>{summary.machineTotal > 0 && <div className="relative h-48"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={summary.machines.filter(g => g.count > 0)} dataKey="count" nameKey="name" innerRadius={58} outerRadius={82} paddingAngle={3} stroke="var(--card)" isAnimationActive={false}>{summary.machines.filter(g => g.count > 0).map(g => <Cell key={g.name} fill={chartColors[summary.machines.indexOf(g) % chartColors.length]} />)}</Pie><Tooltip contentStyle={{ background: "var(--popover)", borderColor: "var(--border)", color: "var(--foreground)" }} formatter={(v: number) => [`${v} เครื่อง`, "จำนวน"]} /></PieChart></ResponsiveContainer><div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><strong className="text-2xl tabular-nums">{summary.machineTotal}</strong><span className="text-xs text-muted-foreground">เครื่อง</span></div></div>}<div className="divide-y">{summary.machines.map((g, i) => <div key={g.name} className="flex items-center justify-between gap-3 py-2.5 text-sm"><span className="flex min-w-0 items-center gap-2"><span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: chartColors[i % chartColors.length] }} />{g.name}</span><span className="shrink-0 tabular-nums"><strong>{g.count}</strong><span className="ml-3 text-xs text-muted-foreground">{g.percent.toFixed(1)}%</span></span></div>)}</div></section>}
      </div>}
      {show.backlog && <section aria-label="งานที่ยังไม่ดำเนินการ" className="min-w-0 border-t pt-6"><div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">งานที่ยังไม่ดำเนินการ <span className="ml-2 text-destructive">{summary.backlog.length}</span></h2><span className="text-xs text-muted-foreground">วันเข้าบริการ · หากยังไม่กำหนด ใช้วันที่บันทึก</span></div><JobTable jobs={summary.backlog} /></section>}
      {!Object.values(show).some(Boolean) && <Empty text="ซ่อนทุกส่วนแล้ว" />}
    </>}
    <Dialog open={valid && !!drill} onOpenChange={open => { if (!open) setDrill(null); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>{drill?.kind === "technician" ? `งานของ ${drill.name}` : drill ? stageLabels[drill.stage] : "รายการงาน"}</DialogTitle><DialogDescription>{exportDateLabel(range.from, range.to)} · {drill ? filterSummaryJobs(summary.jobs, drill).length : 0} งาน</DialogDescription></DialogHeader>
        {drill && <JobTable jobs={filterSummaryJobs(summary.jobs, drill)} />}
      </DialogContent>
    </Dialog>
  </div>;
}
function Empty({ text }: { text: string }) { return <div className="flex min-h-40 flex-col items-center justify-center gap-3 border-y border-dashed text-sm text-muted-foreground"><Wrench className="size-6" />{text}</div>; }
function JobTable({ jobs }: { jobs: ReportJob[] }) {
  if (!jobs.length) return <Empty text="ไม่มีงานในช่วงวันที่เลือก" />;
  return <div className="force-scrollbar max-h-[560px] overflow-auto"><table className="w-full min-w-[840px] border-collapse text-left text-sm"><thead className="sticky top-0 z-10 bg-muted text-muted-foreground"><tr>{["ลูกค้า / S/N", "รายละเอียดงาน", "ช่างรับผิดชอบ", "สถานะ", "วันที่บันทึก", "วันเข้าบริการ", ""].map((h, i) => <th key={i} className="border-b px-4 py-3 font-medium">{h}</th>)}</tr></thead><tbody className="divide-y">{jobs.map(j => <tr key={`${j.source}:${j.id}`} className="bg-card hover:bg-accent/40">
    <td className="max-w-56 break-words px-4 py-4"><Link to="/planner" search={summaryJobSearch(j)} className="font-medium text-primary underline-offset-4 hover:underline focus-visible:underline">{j.customer_name || "เปิดรายละเอียดงาน"}</Link><div className="mt-1 text-xs text-muted-foreground">{j.serial_number || "-"}</div></td>
    <td className="max-w-80 whitespace-pre-wrap break-words px-4 py-4"><Link to="/planner" search={summaryJobSearch(j)} className="block hover:underline">{j.job_detail || "เปิดรายละเอียดงาน"}</Link></td>
    <td className="max-w-48 break-words px-4 py-4">{j.staff_name || "ยังไม่ระบุช่าง"}</td><td className="px-4 py-4">{stageLabels[summaryStage(j)]}</td><td className="whitespace-nowrap px-4 py-4">{toBEDisplay(bangkokDate(j.created_at))}</td><td className="whitespace-nowrap px-4 py-4">{j.visit_date ? toBEDisplay(j.visit_date) : "ยังไม่กำหนด"}</td>
    <td className="px-4 py-4"><div className="flex gap-1"><Button asChild variant="outline" size="sm"><Link to="/planner" search={summaryJobSearch(j)}>เปิดงาน <ArrowRight /></Link></Button><Button asChild variant="ghost" size="icon"><Link to="/planner" search={summaryJobSearch(j)} target="_blank" rel="noopener noreferrer" title="เปิดงานในแท็บใหม่" aria-label={`เปิดงาน ${j.customer_name || j.id} ในแท็บใหม่`}><ExternalLink /></Link></Button></div></td>
  </tr>)}</tbody></table></div>;
}
