import React, { useState } from "react";
import { useUserRole } from "@/lib/user-role";
import { useAccess } from "@/lib/access";
import { Button } from "@/components/ui/button";
import { syncLatestData } from "@/lib/data-sync";
import {
  Briefcase,
  Wrench,
  Users,
  ShieldCheck,
  ArrowLeftRight,
  RotateCw,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * ปุ่มควบคุมบทบาทผู้ใช้งาน และปุ่มซิงก์ข้อมูลล่าสุด
 * ติดตั้งอยู่ที่มุมขวาบนของแถบนำทาง (NavBar) ตลอดเวลา มองเห็นและกดง่ายทุกหน้าจอ
 */
export function UserRoleSwitcherButton() {
  const { role, userName, openRoleSwitcher } = useUserRole();
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      await syncLatestData();
      toast.success("ซิงก์ข้อมูลงานล่าสุดเรียบร้อย");
    } catch {
      toast.error("ซิงก์ข้อมูลไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setTimeout(() => setSyncing(false), 500);
    }
  };

  // Icon according to role
  const roleIcon =
    role === "seller" ? (
      <Briefcase className="h-3.5 w-3.5 text-primary shrink-0" />
    ) : role === "tech" ? (
      <Wrench className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
    ) : role === "admin" ? (
      <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
    ) : (
      <Users className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
    );

  // Label according to role
  const roleLabel =
    role === "seller"
      ? `เซลล์: ${userName || "-"}`
      : role === "tech"
        ? `ช่าง: ${userName || "-"}`
        : role === "admin"
          ? "แอดมิน"
          : "ผู้ใช้ทั่วไป";

  return (
    <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
      {/* Quick Sync Button */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleSync}
        disabled={syncing}
        title="รีเฟรช / ซิงก์ข้อมูลงานล่าสุด"
        aria-label="รีเฟรชข้อมูลล่าสุด"
        className="h-8.5 px-2 sm:px-2.5 text-xs gap-1 border-border/80 hover:bg-accent cursor-pointer rounded-lg"
      >
        <RotateCw
          className={cn("h-3.5 w-3.5 text-muted-foreground", syncing && "animate-spin text-primary")}
        />
        <span className="hidden sm:inline font-normal text-muted-foreground">ซิงก์</span>
      </Button>

      {/* Switch Role / Change User Button */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={openRoleSwitcher}
        title="เปลี่ยนบทบาท / สลับผู้ใช้งาน (กดเพื่อเปลี่ยน)"
        aria-label="เปลี่ยนบทบาท / สลับผู้ใช้งาน"
        className={cn(
          "h-8.5 px-2.5 sm:px-3 text-xs gap-1.5 border-2 font-medium cursor-pointer transition-all shadow-2xs rounded-lg active:scale-95",
          role === "seller" &&
            "border-primary/50 bg-primary/10 hover:bg-primary/20 text-foreground ring-1 ring-primary/20",
          role === "tech" &&
            "border-blue-500/50 bg-blue-500/10 hover:bg-blue-500/20 text-foreground dark:border-blue-400/50 ring-1 ring-blue-500/20",
          role === "admin" &&
            "border-emerald-500/50 bg-emerald-500/10 hover:bg-emerald-500/20 text-foreground dark:border-emerald-400/50 ring-1 ring-emerald-500/20",
          (!role || role === "general") &&
            "border-amber-500/50 bg-amber-500/10 hover:bg-amber-500/20 text-foreground dark:border-amber-400/50 ring-1 ring-amber-500/20",
        )}
      >
        {roleIcon}
        <span className="max-w-[100px] xs:max-w-[130px] sm:max-w-[160px] truncate font-semibold">
          {roleLabel}
        </span>
        <ArrowLeftRight className="h-3 w-3 opacity-60 ml-0.5 shrink-0 hidden xs:inline" />
      </Button>
    </div>
  );
}
