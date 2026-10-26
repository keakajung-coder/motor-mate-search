import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { DateInput } from "@/components/ui/date-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  generateContractSchedule,
  THAI_DOW_NAMES,
  type AutoScheduleRuleConfig,
  type GeneratedVisitPreview,
  type SchedulePattern,
} from "@/lib/contract-schedule";
import { Sparkles, CalendarClock, CalendarDays, Check, RefreshCw, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const DOW_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 1, label: "วันจันทร์" },
  { value: 2, label: "วันอังคาร" },
  { value: 3, label: "วันพุธ" },
  { value: 4, label: "วันพฤหัสบดี" },
  { value: 5, label: "วันศุกร์" },
  { value: 6, label: "วันเสาร์" },
  { value: 0, label: "วันอาทิตย์" },
];

const WEEK_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 1, label: "สัปดาห์ที่ 1" },
  { value: 2, label: "สัปดาห์ที่ 2" },
  { value: 3, label: "สัปดาห์ที่ 3" },
  { value: 4, label: "สัปดาห์ที่ 4" },
  { value: -1, label: "สัปดาห์สุดท้ายของเดือน" },
];

const FREQUENCY_PRESETS = [
  { count: 4, label: "4 ครั้ง/ปี (ทุก 3 เดือน)" },
  { count: 6, label: "6 ครั้ง/ปี (ทุก 2 เดือน)" },
  { count: 12, label: "12 ครั้ง/ปี (ทุกเดือน)" },
  { count: 2, label: "2 ครั้ง/ปี (ทุก 6 เดือน)" },
  { count: 1, label: "1 ครั้ง/ปี (ปีละครั้ง)" },
];

export function AutoScheduleRuleModal({
  open,
  onOpenChange,
  initialStartDate,
  initialVisitsPerYear = 4,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialStartDate: string;
  initialVisitsPerYear?: number;
  onApply: (visits: GeneratedVisitPreview[]) => void;
}) {
  const [startDate, setStartDate] = useState<string>(initialStartDate);
  const [visitsPerYear, setVisitsPerYear] = useState<number>(initialVisitsPerYear || 4);
  const [patternType, setPatternType] = useState<"fixed_date" | "relative_day">("fixed_date");

  // Pattern A: Fixed date
  const [dayOfMonth, setDayOfMonth] = useState<number>(() => {
    const d = parseInt(initialStartDate.slice(8, 10), 10);
    return isNaN(d) ? 15 : Math.max(1, Math.min(31, d));
  });

  // Pattern B: Relative day
  const [weekOfMonth, setWeekOfMonth] = useState<number>(2); // สัปดาห์ที่ 2
  const [dayOfWeek, setDayOfWeek] = useState<number>(3); // วันพุธ

  // Default time
  const [defaultTime, setDefaultTime] = useState<string>("09:00");

  const cycleMonthsText = useMemo(() => {
    if (visitsPerYear <= 0) return "-";
    const step = 12 / visitsPerYear;
    if (step >= 1) {
      return Number.isInteger(step)
        ? `ทุก ${step} เดือน`
        : `ทุกประมาณ ${step.toFixed(1)} เดือน`;
    }
    return `กระจาย ${visitsPerYear} ครั้งในรอบปี`;
  }, [visitsPerYear]);

  const patternConfig = useMemo<SchedulePattern>(() => {
    if (patternType === "fixed_date") {
      return {
        type: "fixed_date",
        dayOfMonth: Math.max(1, Math.min(31, dayOfMonth)),
      };
    }
    return {
      type: "relative_day",
      weekOfMonth: weekOfMonth as 1 | 2 | 3 | 4 | -1,
      dayOfWeek: dayOfWeek as 0 | 1 | 2 | 3 | 4 | 5 | 6,
    };
  }, [patternType, dayOfMonth, weekOfMonth, dayOfWeek]);

  const previewVisits = useMemo<GeneratedVisitPreview[]>(() => {
    return generateContractSchedule({
      startDate,
      visitsPerYear,
      pattern: patternConfig,
      defaultTime,
    });
  }, [startDate, visitsPerYear, patternConfig, defaultTime]);

  const handleApply = () => {
    onApply(previewVisits);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(calc(100vw-1.5rem),720px)] max-w-[720px] max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl bg-background border shadow-2xl">
        <DialogHeader className="p-4 sm:p-6 pb-3 border-b bg-muted/20 shrink-0">
          <div className="flex items-center gap-2 text-primary">
            <Sparkles className="h-5 w-5" />
            <DialogTitle className="text-lg sm:text-xl font-bold">
              ตั้งค่าและคำนวณงวดอัตโนมัติ (Auto-Schedule Rules)
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs sm:text-sm text-muted-foreground">
            กำหนดรอบบริการและรูปแบบการวางวัน ระบบจะคำนวณรันวันที่และซอยรอบเดือนให้อัตโนมัติทั้งสัญญาในคลิกเดียว
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* 1. Cycle & Frequency */}
          <div className="space-y-3 rounded-xl border bg-card/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label className="text-sm font-semibold flex items-center gap-1.5">
                <CalendarClock className="h-4 w-4 text-primary" />
                รอบบริการ (Frequency)
              </Label>
              <Badge variant="outline" className="font-semibold text-xs border-primary/30 text-primary bg-primary/5">
                คำนวณวนลูปอัตโนมัติ: {cycleMonthsText}
              </Badge>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {FREQUENCY_PRESETS.map((p) => (
                <Button
                  key={p.count}
                  type="button"
                  variant={visitsPerYear === p.count ? "default" : "outline"}
                  size="sm"
                  className="h-8 text-xs font-normal"
                  onClick={() => setVisitsPerYear(p.count)}
                >
                  {p.label}
                </Button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <Label className="text-xs text-muted-foreground">จำนวนครั้งเข้าบริการต่อปี</Label>
                <Input
                  type="number"
                  min={1}
                  max={52}
                  className="h-9 font-medium"
                  value={visitsPerYear}
                  onChange={(e) => setVisitsPerYear(Math.max(1, Math.min(52, parseInt(e.target.value, 10) || 1)))}
                />
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">วันเริ่มสัญญา</Label>
                <DateInput value={startDate} onChange={setStartDate} size="sm" />
              </div>
            </div>
          </div>

          {/* 2. Recurrence Pattern Selection */}
          <div className="space-y-3 rounded-xl border bg-card/60 p-4">
            <Label className="text-sm font-semibold flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4 text-primary" />
              เลือกรูปแบบการวางวัน (Recurrence Pattern)
            </Label>

            {/* Pattern Type Switch Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPatternType("fixed_date")}
                className={cn(
                  "flex flex-col text-left p-3 rounded-xl border-2 transition-all cursor-pointer",
                  patternType === "fixed_date"
                    ? "border-primary bg-primary/10 text-primary shadow-xs"
                    : "border-border hover:border-primary/40 bg-card",
                )}
              >
                <div className="flex items-center justify-between font-semibold text-sm">
                  <span>รูปแบบ A: วันที่แน่นอน (Fixed Date)</span>
                  {patternType === "fixed_date" && <Check className="h-4 w-4" />}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  กำหนดวันที่คงที่ เช่น ทุกวันที่ 15 ของรอบเดือน
                </p>
              </button>

              <button
                type="button"
                onClick={() => setPatternType("relative_day")}
                className={cn(
                  "flex flex-col text-left p-3 rounded-xl border-2 transition-all cursor-pointer",
                  patternType === "relative_day"
                    ? "border-primary bg-primary/10 text-primary shadow-xs"
                    : "border-border hover:border-primary/40 bg-card",
                )}
              >
                <div className="flex items-center justify-between font-semibold text-sm">
                  <span>รูปแบบ B: วันในสัปดาห์ (Relative Day)</span>
                  {patternType === "relative_day" && <Check className="h-4 w-4" />}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  เลือกสัปดาห์และวัน เช่น ทุกวันพุธ สัปดาห์ที่ 2 ของรอบเดือน
                </p>
              </button>
            </div>

            {/* Config Inputs for Selected Pattern */}
            {patternType === "fixed_date" ? (
              <div className="pt-2 space-y-2 rounded-lg bg-muted/40 p-3 border">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <span className="text-xs font-medium whitespace-nowrap">กำหนดวันที่เข้าบริการ:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">ทุกวันที่</span>
                    <Input
                      type="number"
                      min={1}
                      max={31}
                      className="h-8 w-20 text-center font-bold"
                      value={dayOfMonth}
                      onChange={(e) => setDayOfMonth(Math.max(1, Math.min(31, parseInt(e.target.value, 10) || 1)))}
                    />
                    <span className="text-xs text-muted-foreground">ของรอบเดือน</span>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  * หากเดือนใดมีวันไม่ถึง (เช่น ก.พ. หรือเดือนที่มี 30 วัน) ระบบจะปัดให้อยู่ในวันสุดท้ายของเดือนนั้นโดยอัตโนมัติ
                </p>
              </div>
            ) : (
              <div className="pt-2 space-y-2 rounded-lg bg-muted/40 p-3 border">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">เลือกลำดับสัปดาห์</Label>
                    <Select
                      value={String(weekOfMonth)}
                      onValueChange={(val) => setWeekOfMonth(parseInt(val, 10))}
                    >
                      <SelectTrigger className="h-8 w-full bg-background">
                        <SelectValue placeholder="เลือกลำดับสัปดาห์" />
                      </SelectTrigger>
                      <SelectContent>
                        {WEEK_OPTIONS.map((w) => (
                          <SelectItem key={w.value} value={String(w.value)}>
                            {w.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground">เลือกวันในสัปดาห์</Label>
                    <Select
                      value={String(dayOfWeek)}
                      onValueChange={(val) => setDayOfWeek(parseInt(val, 10))}
                    >
                      <SelectTrigger className="h-8 w-full bg-background">
                        <SelectValue placeholder="เลือกวันในสัปดาห์" />
                      </SelectTrigger>
                      <SelectContent>
                        {DOW_OPTIONS.map((d) => (
                          <SelectItem key={d.value} value={String(d.value)}>
                            {d.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  เช่น "ทุก{THAI_DOW_NAMES[dayOfWeek]} {WEEK_OPTIONS.find((w) => w.value === weekOfMonth)?.label} ของรอบเดือน"
                </p>
              </div>
            )}

            {/* Default Time */}
            <div className="flex items-center gap-3 pt-1">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">เวลาเข้าบริการเริ่มต้น (ไม่บังคับ):</Label>
              <Input
                type="time"
                className="h-8 w-32 bg-background font-mono text-xs"
                value={defaultTime}
                onChange={(e) => setDefaultTime(e.target.value)}
              />
            </div>
          </div>

          {/* 3. Live Calculated Preview */}
          <div className="space-y-3 rounded-xl border bg-card/60 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-primary" />
                <Label className="text-sm font-semibold">
                  ตัวอย่างงวดบริการที่คำนวณได้ ({previewVisits.length} ครั้ง)
                </Label>
              </div>
              <Badge variant="outline" className="text-xs border-amber-400 bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                สถานะเริ่มต้น: ยังไม่ได้นัดหมาย (Unscheduled)
              </Badge>
            </div>

            <div
              className="space-y-2 max-h-56 dropdown-scroll !overflow-y-scroll pr-1"
              style={{ overflowY: "scroll" }}
            >
              {previewVisits.map((v) => (
                <div
                  key={v.visit_no}
                  className="flex items-center justify-between p-2.5 rounded-lg border bg-background text-xs hover:border-primary/40 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 font-bold text-primary text-[11px]">
                      {v.visit_no}
                    </span>
                    <div>
                      <span className="font-semibold text-foreground">
                        {v.visit_date} ({v.dayOfWeekLabelTh})
                      </span>
                      <span className="text-muted-foreground ml-2">
                        {v.cycleLabelTh}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {v.visit_time && (
                      <span className="font-mono text-muted-foreground">
                        {v.visit_time} น.
                      </span>
                    )}
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-900/15 text-rose-900 border border-rose-800/30 dark:bg-rose-950/60 dark:text-rose-200">
                      Unscheduled
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 p-2.5 rounded-lg border">
              <AlertCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span>
                ทุกงวดที่สร้างขึ้นอัตโนมัติจะมีสถานะเริ่มต้นเป็น <strong>"ยังไม่ได้นัดหมาย (Unscheduled)"</strong> และแอดมินสามารถกดแก้ไขวัน/เวลาแยกแต่ละงวดเพื่อเลื่อนหลบวันหยุดได้อิสระ
              </span>
            </div>
          </div>
        </div>

        <DialogFooter className="p-4 sm:p-6 pt-3 border-t bg-muted/20 flex-row justify-between shrink-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            ยกเลิก
          </Button>
          <Button
            type="button"
            className="gap-1.5 font-semibold cursor-pointer shadow-sm"
            onClick={handleApply}
          >
            <Sparkles className="h-4 w-4" />
            คำนวณและนำไปใช้ ({previewVisits.length} งวด)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
