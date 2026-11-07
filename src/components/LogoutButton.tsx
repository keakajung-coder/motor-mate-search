import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAccess } from "@/lib/access";
import { useUserRole, STORAGE_LAST_SELLER_KEY, STORAGE_LAST_TECH_KEY } from "@/lib/user-role";
import { toast } from "sonner";

export function LogoutButton() {
  const [busy, setBusy] = useState(false);
  const { lockAll } = useAccess();
  const { clearRole, closeRoleSwitcher } = useUserRole();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  async function logout() {
    setBusy(true);
    try {
      await queryClient.cancelQueries();
      await lockAll();
      queryClient.clear();
      clearRole();
      closeRoleSwitcher();
      try {
        localStorage.removeItem(STORAGE_LAST_SELLER_KEY);
        localStorage.removeItem(STORAGE_LAST_TECH_KEY);
      } catch { /* Storage may be unavailable. */ }
      await navigate({ to: "/", replace: true });
    } catch {
      toast.error("ออกจากระบบไม่สำเร็จ กรุณาตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง");
    } finally { setBusy(false); }
  }
  return <Button variant="outline" size="sm" onClick={logout} disabled={busy} className="shrink-0 gap-2 rounded-md" aria-label="ออกจากระบบ">
    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}<span>ออกจากระบบ</span>
  </Button>;
}