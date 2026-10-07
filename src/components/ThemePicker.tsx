import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTheme, type ThemeMode, type ThemePreset } from "@/lib/theme";
import { Sun, Moon, Monitor, Check } from "lucide-react";

export function ThemePicker() {
  const [open, setOpen] = useState(false);
  const { mode, setMode, isDark, preset, setPreset, presets } = useTheme();

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5"
        title="เลือกโหมดมืด/สว่าง และธีมสี"
      >
        <span
          className="inline-block h-3.5 w-3.5 shrink-0 rounded-full border shadow-xs"
          style={{ background: preset.swatch }}
        />
        {isDark ? <Moon className="h-3.5 w-3.5 text-blue-400" /> : <Sun className="h-3.5 w-3.5 text-amber-500" />}
        <span className="hidden sm:inline">ธีมสี & โหมด</span>
        <span className="sm:hidden">{isDark ? "โหมดมืด" : "โหมดสว่าง"}</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>เลือกธีมและโหมดการแสดงผล</span>
            </DialogTitle>
            <DialogDescription>
              เลือกโหมดมืดหรือโหมดสว่าง และชุดสีหลักที่ต้องการใช้งาน
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* โหมดแสดงผล (มืด / สว่าง / ตามระบบ) */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                โหมดการแสดงผล
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setMode("light")}
                  className={
                    "flex flex-col items-center justify-center gap-1.5 rounded-xl border p-3 text-xs font-medium transition-all " +
                    (mode === "light"
                      ? "border-primary bg-primary/10 text-primary shadow-xs ring-2 ring-primary"
                      : "hover:bg-accent text-muted-foreground hover:text-foreground")
                  }
                >
                  <Sun className="h-5 w-5 text-amber-500" />
                  <span>โหมดสว่าง</span>
                  {mode === "light" && <Check className="h-3 w-3 text-primary" />}
                </button>

                <button
                  type="button"
                  onClick={() => setMode("dark")}
                  className={
                    "flex flex-col items-center justify-center gap-1.5 rounded-xl border p-3 text-xs font-medium transition-all " +
                    (mode === "dark"
                      ? "border-primary bg-primary/10 text-primary shadow-xs ring-2 ring-primary"
                      : "hover:bg-accent text-muted-foreground hover:text-foreground")
                  }
                >
                  <Moon className="h-5 w-5 text-blue-400" />
                  <span>โหมดมืด</span>
                  {mode === "dark" && <Check className="h-3 w-3 text-primary" />}
                </button>

                <button
                  type="button"
                  onClick={() => setMode("system")}
                  className={
                    "flex flex-col items-center justify-center gap-1.5 rounded-xl border p-3 text-xs font-medium transition-all " +
                    (mode === "system"
                      ? "border-primary bg-primary/10 text-primary shadow-xs ring-2 ring-primary"
                      : "hover:bg-accent text-muted-foreground hover:text-foreground")
                  }
                >
                  <Monitor className="h-5 w-5 text-muted-foreground" />
                  <span>ตามระบบ</span>
                  {mode === "system" && <Check className="h-3 w-3 text-primary" />}
                </button>
              </div>
            </div>

            {/* ชุดสีหลัก */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                ชุดสีหลัก (Accent Color)
              </label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {presets.map((p: ThemePreset) => {
                  const active = preset.swatch === p.swatch;
                  return (
                    <button
                      key={p.swatch}
                      type="button"
                      onClick={() => setPreset(p)}
                      className={
                        "relative flex flex-col items-center gap-2 rounded-xl border p-3 text-xs transition-all " +
                        (active
                          ? "border-primary bg-primary/5 font-semibold text-primary shadow-xs ring-2 ring-primary"
                          : "hover:bg-accent text-muted-foreground hover:text-foreground")
                      }
                    >
                      <span
                        className="relative flex h-9 w-9 items-center justify-center rounded-full border shadow-inner"
                        style={{ background: p.swatch }}
                      >
                        {active && <Check className="h-4 w-4 text-white drop-shadow-md" />}
                      </span>
                      <span className="text-center leading-tight line-clamp-1">{p.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** ปุ่มสลับโหมดมืด/สว่างแบบด่วน 1 คลิก */
export function ThemeQuickToggle() {
  const { isDark, toggleMode } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleMode}
      title={isDark ? "เปลี่ยนเป็นโหมดสว่าง" : "เปลี่ยนเป็นโหมดมืด"}
      className="h-9 w-9 rounded-full"
    >
      {isDark ? (
        <Sun className="h-4 w-4 text-amber-400 transition-transform duration-300 hover:rotate-45" />
      ) : (
        <Moon className="h-4 w-4 text-slate-700 transition-transform duration-300 hover:-rotate-12 dark:text-slate-300" />
      )}
      <span className="sr-only">สลับโหมดมืด/สว่าง</span>
    </Button>
  );
}
