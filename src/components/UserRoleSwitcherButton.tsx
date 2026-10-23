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
  const { isAdmin } = useAccess();
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
      <Briefcase className="h-4 w-4 text-primary" />
    ) : role === "tech" ? (
      <Wrench className="h-4 w-4 text-blue-600 dark:text-blue-400" />
    ) : role === "admin" ? (
      <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
    ) : (
      <Users className="h-4 w-4 text-amber-600 dark:text-amber-400" />
    );

  // Label according to role
  const roleLabel =
    role === "seller"
      ? `ผู้ขาย: ${userName || "-"}`
      : role === "tech"
        ? `ช่าง: ${userName || "-"}`
        : role === "admin"
          ? "แอดมิน"
          : "ผู้ใช้ทั่วไป";

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {/* Quick Sync Button */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleSync}
        disabled={syncing}
        title="รีเฟรช / ซิงก์ข้อมูลงานล่าสุด"
        className="h-8 px-2 sm:px-2.5 text-xs gap-1 border-border/80 hover:bg-accent cursor-pointer"
      >
        <RotateCw
          className={cn("h-3.5 w-3.5 text-muted-foreground", syncing && "animate-spin text-primary")}
        />
        <span className="hidden md:inline font-normal">ซิงก์</span>
      </Button>

      {/* Switch Role / Change User Button */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={openRoleSwitcher}
        title="เปลี่ยนบทบาท / สลับผู้ใช้งาน"
        className={cn(
          "h-8 px-2.5 sm:px-3 text-xs gap-1.5 border-2 font-medium cursor-pointer transition-all shadow-2xs",
          role === "seller" && "border-primary/40 bg-primary/5 hover:bg-primary/10 text-foreground",
          role === "tech" &&
            "border-blue-500/40 bg-blue-500/5 hover:bg-blue-500/10 text-foreground dark:border-blue-400/40",
          role === "admin" &&
            "border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/10 text-foreground dark:border-emerald-400/40",
          (!role || role === "general") &&
            "border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/10 text-foreground dark:border-amber-400/40",
        )}
      >
        {roleIcon}
        <span className="max-w-[120px] sm:max-w-[160px] truncate">{roleLabel}</span>
        <ArrowLeftRight className="h-3 w-3 opacity-60 ml-0.5 shrink-0" />
      </Button>
    </div>
  );
}
