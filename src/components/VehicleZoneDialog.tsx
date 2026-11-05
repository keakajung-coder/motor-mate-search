import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { useAccess } from "@/lib/access";
import type { ZoneReview } from "@/lib/vehicle-zone";
import type { ZoneDecision } from "@/lib/vehicle-zone-client";

type Pending = { review: ZoneReview; resolve: (value: ZoneDecision) => void };
export function VehicleZoneDialog() {
  const [pending, setPending] = useState<Pending | null>(null);
  const [moving, setMoving] = useState(false);
  const [vehicle, setVehicle] = useState("");
  const { isAdmin } = useAccess();
  useEffect(() => {
    let active: Pending | null = null;
    const handler = (e: Event) => {
      active?.resolve(null);
      active = (e as CustomEvent<Pending>).detail;
      setPending(active); setMoving(false); setVehicle("");
    };
    window.addEventListener("app:zone-review", handler);
    return () => { window.removeEventListener("app:zone-review", handler); active?.resolve(null); };
  }, []);
  const finish = (decision: ZoneDecision) => { pending?.resolve(decision); setPending(null); };
  return <Dialog open={!!pending} onOpenChange={open => { if (!open) finish(null); }}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>⚠️ รถ {pending?.review.conflicts.map(c => c.plate).join(", ")} มีงานข้ามโซน ต้องการอนุมัติหรือไม่?</DialogTitle>
        <DialogDescription>{pending?.review.conflicts.map(c => `รถ ${c.plate}: ${c.otherProvinces.join(" / ")} → ${c.province}`).join(" · ")}</DialogDescription>
      </DialogHeader>
      {!isAdmin && <p className="text-sm text-destructive">การอนุมัติข้ามโซนต้องใช้สิทธิ์แอดมิน</p>}
      {moving && <Combobox value={vehicle} onChange={setVehicle} options={(pending?.review.vehicles ?? []).filter(p => !pending?.review.conflicts.some(c => c.plate === p)).map(value => ({ value }))} placeholder="เลือกทะเบียนรถคันอื่น" />}
      <DialogFooter>
        <Button variant="ghost" onClick={() => finish(null)}>ยกเลิก</Button>
        <Button variant="outline" onClick={() => { if (!moving) setMoving(true); else if (vehicle.trim()) finish({ vehicle: vehicle.trim() }); }} disabled={moving && !vehicle.trim()}>ย้ายไปรถคันอื่น</Button>
        <Button disabled={!isAdmin} onClick={() => finish({ approve: true })}>อนุมัติ (Approve)</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}