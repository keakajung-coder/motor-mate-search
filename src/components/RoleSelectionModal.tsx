import React, { useState, useEffect, useMemo, useRef } from "react";
import { useUserRole, type AppUserRole } from "@/lib/user-role";
import { useAccess } from "@/lib/access";
import { useSellerNames } from "@/lib/sellers";
import { useDirectory } from "@/lib/directory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Briefcase,
  Wrench,
  Users,
  ShieldCheck,
  Search,
  Check,
  ChevronRight,
  Loader2,
  Lock,
  ArrowRight,
  UserCheck,
  X,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const PASSCODE_INPUT = {
  type: "password",
  inputMode: "text",
  autoCapitalize: "none",
  autoCorrect: "off",
  spellCheck: false,
} as const;

export function RoleSelectionView({
  onDone,
  isModal = false,
}: {
  onDone?: () => void;
  isModal?: boolean;
}) {
  const {
    role: currentRole,
    userName: currentUserName,
    lastSellerName,
    lastTechName,
    setRoleAndUser,
  } = useUserRole();
  const { isAdmin, unlockAdmin } = useAccess();

  const sellerList = useSellerNames();
  const dir = useDirectory();
  const techList = dir.staff;

  // Selected tab/role inside selector
  const [selectedRole, setSelectedRole] = useState<AppUserRole>(currentRole || "general");
  const [selectedUser, setSelectedUser] = useState<string>(currentUserName || "");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Admin passcode prompt
  const [adminCode, setAdminCode] = useState<string>("");
  const [unlockingAdmin, setUnlockingAdmin] = useState<boolean>(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Sync with current user when opening
  useEffect(() => {
    if (currentRole) setSelectedRole(currentRole);
    if (currentUserName) setSelectedUser(currentUserName);
  }, [currentRole, currentUserName]);

  // When changing role, reset search & auto-select matching default
  const handleSelectRoleType = (newRole: AppUserRole) => {
    setSelectedRole(newRole);
    setSearchQuery("");
    if (newRole === "seller") {
      if (currentRole === "seller" && currentUserName) {
        setSelectedUser(currentUserName);
      } else if (lastSellerName && sellerList.includes(lastSellerName)) {
        setSelectedUser(lastSellerName);
      } else if (sellerList.length > 0) {
        setSelectedUser(sellerList[0]);
      } else {
        setSelectedUser("");
      }
    } else if (newRole === "tech") {
      if (currentRole === "tech" && currentUserName) {
        setSelectedUser(currentUserName);
      } else if (lastTechName && techList.includes(lastTechName)) {
        setSelectedUser(lastTechName);
      } else if (techList.length > 0) {
        setSelectedUser(techList[0]);
      } else {
        setSelectedUser("");
      }
    } else {
      setSelectedUser("");
    }
  };

  // Filtered names for seller/tech
  const filteredNames = useMemo(() => {
    const list = selectedRole === "seller" ? sellerList : selectedRole === "tech" ? techList : [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter((n) => n.toLowerCase().includes(q));
  }, [selectedRole, sellerList, techList, searchQuery]);

  const handleConfirm = async (skipPasscodeUnlock = false) => {
    if (selectedRole === "seller") {
      if (!selectedUser.trim()) {
        toast.error("กรุณาเลือกรายชื่อผู้ขายของท่าน");
        return;
      }
      setRoleAndUser("seller", selectedUser.trim());
      toast.success(`เข้าใช้งานในฐานะผู้ขาย: ${selectedUser.trim()}`);
      onDone?.();
      return;
    }

    if (selectedRole === "tech") {
      if (!selectedUser.trim()) {
        toast.error("กรุณาเลือกรายชื่อช่างของท่าน");
        return;
      }
      setRoleAndUser("tech", selectedUser.trim());
      toast.success(`เข้าใช้งานในฐานะช่าง: ${selectedUser.trim()}`);
      onDone?.();
      return;
    }

    if (selectedRole === "admin") {
      if (isAdmin || skipPasscodeUnlock) {
        setRoleAndUser("admin", "ผู้ดูแลระบบ");
        toast.success(
          isAdmin
            ? "เข้าใช้งานในฐานะผู้ดูแลระบบ (สิทธิ์เต็ม)"
            : "เข้าใช้งานในฐานะผู้ดูแลระบบ (เห็นงานทั้งหมด)",
        );
        onDone?.();
        return;
      }

      // If user typed admin passcode, unlock server session
      if (adminCode.trim()) {
        setUnlockingAdmin(true);
        const ok = await unlockAdmin(adminCode.trim());
        setUnlockingAdmin(false);
        if (ok) {
          setRoleAndUser("admin", "ผู้ดูแลระบบ");
          toast.success("ปลดล็อกโหมดแอดมินสำเร็จ");
          onDone?.();
        } else {
          toast.error("รหัสผ่านแอดมินไม่ถูกต้อง");
          setAdminCode("");
        }
        return;
      }

      // If no passcode entered, still allow viewing all jobs as admin
      setRoleAndUser("admin", "ผู้ดูแลระบบ");
      toast.success("เข้าใช้งานในฐานะผู้ดูแลระบบ (เห็นงานทั้งหมด)");
      onDone?.();
      return;
    }

    // General user
    setRoleAndUser("general", "");
    toast.success("เข้าใช้งานในฐานะผู้ใช้ทั่วไป");
    onDone?.();
  };

  return (
    <div className="w-full space-y-4">
      {/* Role Selection Buttons Grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* Role 1: ผู้ขาย */}
        <button
          type="button"
          onClick={() => handleSelectRoleType("seller")}
          className={cn(
            "group relative flex items-start gap-3.5 rounded-xl border-2 p-4 text-left transition-all duration-200 cursor-pointer min-h-[88px]",
            selectedRole === "seller"
              ? "border-primary bg-primary/10 shadow-md ring-2 ring-primary/30"
              : "border-border/80 bg-card hover:border-primary/50 hover:bg-accent/40",
          )}
        >
          <div
            className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-colors",
              selectedRole === "seller"
                ? "bg-primary text-primary-foreground"
                : "bg-primary/10 text-primary group-hover:bg-primary/20",
            )}
          >
            <Briefcase className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1">
              <span className="font-bold text-base text-foreground">ผู้ขาย / เซลล์</span>
              {selectedRole === "seller" && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="h-3 w-3 stroke-[3]" />
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
              ดูงานลูกค้าของตนเอง คิวงานเซลล์ และภาระงานรวม
            </p>
          </div>
        </button>

        {/* Role 2: ช่าง */}
        <button
          type="button"
          onClick={() => handleSelectRoleType("tech")}
          className={cn(
            "group relative flex items-start gap-3.5 rounded-xl border-2 p-4 text-left transition-all duration-200 cursor-pointer min-h-[88px]",
            selectedRole === "tech"
              ? "border-blue-500 bg-blue-500/10 shadow-md ring-2 ring-blue-500/30 dark:border-blue-400"
              : "border-border/80 bg-card hover:border-blue-500/50 hover:bg-accent/40",
          )}
        >
          <div
            className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-colors",
              selectedRole === "tech"
                ? "bg-blue-600 text-white dark:bg-blue-500"
                : "bg-blue-500/10 text-blue-600 dark:text-blue-400 group-hover:bg-blue-500/20",
            )}
          >
            <Wrench className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1">
              <span className="font-bold text-base text-foreground">ช่างเทคนิค</span>
              {selectedRole === "tech" && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white">
                  <Check className="h-3 w-3 stroke-[3]" />
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
              ดูงานที่ได้รับมอบหมาย คิวนัดหมาย และลงบันทึกการทำงาน
            </p>
          </div>
        </button>

        {/* Role 3: ผู้ใช้ทั่วไป */}
        <button
          type="button"
          onClick={() => handleSelectRoleType("general")}
          className={cn(
            "group relative flex items-start gap-3.5 rounded-xl border-2 p-4 text-left transition-all duration-200 cursor-pointer min-h-[88px]",
            selectedRole === "general"
              ? "border-amber-500 bg-amber-500/10 shadow-md ring-2 ring-amber-500/30 dark:border-amber-400"
              : "border-border/80 bg-card hover:border-amber-500/50 hover:bg-accent/40",
          )}
        >
          <div
            className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-colors",
              selectedRole === "general"
                ? "bg-amber-600 text-white dark:bg-amber-500"
                : "bg-amber-500/10 text-amber-600 dark:text-amber-400 group-hover:bg-amber-500/20",
            )}
          >
            <Users className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1">
              <span className="font-bold text-base text-foreground">ผู้ใช้ทั่วไป</span>
              {selectedRole === "general" && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-600 text-white">
                  <Check className="h-3 w-3 stroke-[3]" />
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
              เข้าใช้งานแบบปกติ ดูภาพรวมรายการงานทั้งหมดในระบบ
            </p>
          </div>
        </button>

        {/* Role 4: แอดมิน */}
        <button
          type="button"
          onClick={() => handleSelectRoleType("admin")}
          className={cn(
            "group relative flex items-start gap-3.5 rounded-xl border-2 p-4 text-left transition-all duration-200 cursor-pointer min-h-[88px]",
            selectedRole === "admin"
              ? "border-emerald-500 bg-emerald-500/10 shadow-md ring-2 ring-emerald-500/30 dark:border-emerald-400"
              : "border-border/80 bg-card hover:border-emerald-500/50 hover:bg-accent/40",
          )}
        >
          <div
            className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-colors",
              selectedRole === "admin"
                ? "bg-emerald-600 text-white dark:bg-emerald-500"
                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-500/20",
            )}
          >
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1">
              <span className="font-bold text-base text-foreground">ผู้ดูแลระบบ (Admin)</span>
              {selectedRole === "admin" && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white">
                  <Check className="h-3 w-3 stroke-[3]" />
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
              จัดการงานทั้งหมด สิทธิ์การอนุมัติ และตั้งค่าระบบ
            </p>
          </div>
        </button>
      </div>

      {/* Detail Section: If Seller or Tech is selected, show Searchable Dropdown with visible scrollbar */}
      {(selectedRole === "seller" || selectedRole === "tech") && (
        <div className="rounded-xl border border-primary/20 bg-muted/30 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
              <UserCheck className="h-4 w-4 text-primary" />
              เลือกรายชื่อ{selectedRole === "seller" ? "ผู้ขาย / เซลล์" : "ช่างเทคนิค"}ของท่าน:
            </label>
            {selectedUser && (
              <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                เลือกแล้ว: {selectedUser}
              </span>
            )}
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`พิมพ์ค้นหาชื่อ${selectedRole === "seller" ? "ผู้ขาย" : "ช่าง"}...`}
              className="pl-9 pr-9 h-11 text-sm bg-background shadow-xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* User Names List: Visible Custom Scrollbar & Max-height 4-5 items (approx 190px) */}
          <div className="relative rounded-lg border border-border/80 bg-background overflow-hidden shadow-xs">
            <div className="dropdown-scroll max-h-[190px] overflow-y-auto p-1.5 divide-y divide-border/40">
              {filteredNames.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  ไม่พบรายชื่อที่ตรงกับ &ldquo;{searchQuery}&rdquo;
                </div>
              ) : (
                filteredNames.map((name) => {
                  const isSelected = selectedUser.toLowerCase() === name.toLowerCase();
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setSelectedUser(name)}
                      className={cn(
                        "w-full flex items-center justify-between px-3.5 py-2.5 text-left rounded-md transition-colors cursor-pointer text-sm font-medium",
                        isSelected
                          ? "bg-primary text-primary-foreground font-semibold"
                          : "text-foreground hover:bg-accent hover:text-accent-foreground",
                      )}
                    >
                      <span className="truncate">{name}</span>
                      {isSelected && <Check className="h-4 w-4 shrink-0 stroke-[2.5]" />}
                    </button>
                  );
                })
              )}
            </div>
            <div className="border-t border-border/50 bg-muted/40 px-3 py-1.5 text-[11px] text-muted-foreground flex items-center justify-between">
              <span>แสดงผล {filteredNames.length} รายชื่อ</span>
              <span className="text-[10px]">เลื่อนดูรายชื่อเพิ่มเติมได้</span>
            </div>
          </div>
        </div>
      )}

      {/* Admin Passcode Verification if admin is chosen but not yet unlocked */}
      {selectedRole === "admin" && !isAdmin && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-50/50 p-4 dark:bg-emerald-950/20 space-y-3">
          <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-semibold text-sm">
            <Lock className="h-4 w-4" /> ปลดล็อกสิทธิ์ผู้ดูแลระบบ (Admin Passcode)
          </div>
          <p className="text-xs text-muted-foreground">
            กรอกรหัสเพื่อปลดล็อกสิทธิ์แก้ไข/ลบข้อมูล หรือกดเข้าใช้งานเพื่อดูภาพรวมงานทั้งหมดได้ทันที
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              {...PASSCODE_INPUT}
              value={adminCode}
              onChange={(e) => setAdminCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleConfirm(false)}
              placeholder="รหัสผ่านแอดมิน (ถ้ามี)"
              className="h-11 text-center text-lg tracking-widest bg-background flex-1"
              autoFocus
            />
            {adminCode.trim() && (
              <Button
                type="button"
                variant="outline"
                className="h-11 px-4 border-emerald-500 text-emerald-700 hover:bg-emerald-100 dark:text-emerald-300"
                onClick={() => handleConfirm(false)}
                disabled={unlockingAdmin}
              >
                {unlockingAdmin ? <Loader2 className="h-4 w-4 animate-spin" /> : "ปลดล็อกสิทธิ์"}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Confirmation Submit Button */}
      <Button
        type="button"
        size="lg"
        onClick={() => handleConfirm(selectedRole === "admin" && !adminCode.trim())}
        disabled={
          unlockingAdmin ||
          ((selectedRole === "seller" || selectedRole === "tech") && !selectedUser.trim())
        }
        className={cn(
          "w-full h-12 text-base font-semibold shadow-md transition-all cursor-pointer",
          selectedRole === "seller" && "bg-primary hover:bg-primary/90 text-primary-foreground",
          selectedRole === "tech" && "bg-blue-600 hover:bg-blue-700 text-white",
          selectedRole === "general" && "bg-amber-600 hover:bg-amber-700 text-white",
          selectedRole === "admin" && "bg-emerald-600 hover:bg-emerald-700 text-white",
        )}
      >
        {unlockingAdmin ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            กำลังตรวจสอบรหัส...
          </>
        ) : (
          <>
            <span>
              {selectedRole === "seller" && `ยืนยันเข้าใช้งาน: ${selectedUser || "(กรุณาเลือกชื่อ)"}`}
              {selectedRole === "tech" && `ยืนยันเข้าใช้งาน: ${selectedUser || "(กรุณาเลือกชื่อ)"}`}
              {selectedRole === "general" && "ยืนยันเข้าใช้งาน (ผู้ใช้ทั่วไป)"}
              {selectedRole === "admin" &&
                (isAdmin || adminCode.trim()
                  ? "ยืนยันเข้าใช้งานโหมดแอดมิน"
                  : "เข้าใช้งานโหมดแอดมิน (เห็นงานทั้งหมด)")}
            </span>
            <ArrowRight className="ml-2 h-5 w-5" />
          </>
        )}
      </Button>

      {/* Info note */}
      <p className="text-center text-xs text-muted-foreground">
        ระบบจะบันทึกบทบาทและชื่อล่าสุดไว้ในเครื่องนี้ (Local Storage) ท่านสามารถสลับบทบาทได้ทุกเมื่อที่ปุ่มมุมขวาบน
      </p>
    </div>
  );
}

/**
 * Role Selection Dialog (for switching roles anytime via header button)
 */
export function RoleSelectionDialog() {
  const { isSwitching, closeRoleSwitcher } = useUserRole();

  return (
    <Dialog open={isSwitching} onOpenChange={(open) => !open && closeRoleSwitcher()}>
      <DialogContent className="z-[99999] w-[min(calc(100vw-1.5rem),640px)] max-w-[640px] p-5 sm:p-6 rounded-2xl bg-background border shadow-2xl">
        <DialogHeader className="space-y-1">
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <Sparkles className="h-5 w-5 text-primary" />
            เปลี่ยนบทบาท / สลับผู้ใช้งาน
          </DialogTitle>
          <DialogDescription>
            เลือกบทบาทและรายชื่อเพื่อปรับการแสดงผลรายการงานและสิทธิ์ให้ตรงกับหน้าที่ของท่าน
          </DialogDescription>
        </DialogHeader>

        <div className="pt-2">
          <RoleSelectionView onDone={closeRoleSwitcher} isModal={true} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Gate Screen: Shown right after Passcode Screen if no role/user is selected yet
 */
export function RoleSelectionGateScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <Card className="w-full max-w-2xl border-2 shadow-xl rounded-2xl">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Users className="h-7 w-7" />
          </div>
          <CardTitle className="text-2xl font-bold">เลือกบทบาทและชื่อผู้ใช้งาน</CardTitle>
          <CardDescription className="text-sm">
            ยินดีต้อนรับสู่ระบบบริหารงานและค้นหาอะไหล่ปั๊มลม กรุณาเลือกบทบาทของท่านเพื่อเริ่มใช้งาน
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          <RoleSelectionView />
        </CardContent>
      </Card>
    </div>
  );
}
