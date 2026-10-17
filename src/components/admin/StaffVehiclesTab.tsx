import { useEffect, useState } from "react";
import { supabase } from "@/lib/data-client";
import { deleteAsAdmin, useAccess } from "@/lib/access";
import { refreshDirectory } from "@/lib/directory";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ConfirmButton";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Truck, UserCog } from "lucide-react";

type Staff = { id: string; name: string; phone: string | null; line_contact: string | null };
type Vehicle = { id: string; plate: string; note: string | null };

export function StaffVehiclesTab() {
  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-2">
      <StaffCard />
      <VehicleCard />
    </div>
  );
}

function StaffCard() {
  const { isAdmin } = useAccess();
  const [rows, setRows] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [lineId, setLineId] = useState("");
  const [inactiveCount, setInactiveCount] = useState(0);

  const load = async () => {
    const [{ data: activeList }, { count: inactCount }] = await Promise.all([
      supabase
        .from("service_staff")
        .select("id, name, phone, line_contact")
        .neq("active", false)
        .order("name"),
      supabase
        .from("service_staff")
        .select("id", { count: "exact", head: true })
        .eq("active", false),
    ]);
    setRows((activeList ?? []) as Staff[]);
    setInactiveCount(inactCount ?? 0);
    refreshDirectory();
    setLoading(false);
  };
  useEffect(() => {
    load();
    const onStaffChanged = () => load();
    window.addEventListener("service-staff-changed", onStaffChanged);
    return () => window.removeEventListener("service-staff-changed", onStaffChanged);
  }, []);

  const add = async () => {
    if (!name.trim()) return;
    const { error } = await supabase.from("service_staff").insert({
      name: name.trim(),
      phone: phone.trim() || null,
      line_contact: lineId.trim() || null,
      active: true,
    });
    if (error) return toast.error(error.message);
    setName("");
    setPhone("");
    setLineId("");
    window.dispatchEvent(new Event("service-staff-changed"));
    toast.success("เพิ่มพนักงานแล้ว");
    load();
  };

  const update = async (id: string, patch: Partial<Staff>) => {
    const { error } = await supabase.from("service_staff").update(patch).eq("id", id);
    if (error) toast.error(error.message);
    else {
      window.dispatchEvent(new Event("service-staff-changed"));
      refreshDirectory();
    }
  };

  const remove = async (id: string, staffName: string) => {
    // Soft Delete: ตั้งค่า active = false เพื่อรักษาประวัติการปฏิบัติงานและวันลาย้อนหลัง
    const { error } = await supabase.from("service_staff").update({ active: false }).eq("id", id);
    if (error) return toast.error(error.message);
    const { logAudit } = await import("@/lib/audit");
    await logAudit({
      table: "service_staff",
      recordId: id,
      action: "soft_delete",
      summary: `ลบพนักงาน (Soft Delete: active = false): ${staffName}`,
      changes: { id, name: staffName, active: false },
    });
    window.dispatchEvent(new Event("service-staff-changed"));
    toast.success(`ลบพนักงาน "${staffName}" แล้ว (กู้คืนได้ที่หน้าถังขยะ)`);
    refreshDirectory();
    load();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2">
            <UserCog className="h-4 w-4" /> พนักงานเซอร์วิส ({rows.length})
          </span>
          {inactiveCount > 0 && (
            <span className="text-xs font-normal text-muted-foreground">
              มีพนักงานถูกลบ {inactiveCount} คน (กู้คืนได้ที่แท็บถังขยะ)
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid min-w-0 grid-cols-1 gap-2 lg:grid-cols-[repeat(3,minmax(0,1fr))_auto]">
          <Input placeholder="ชื่อพนักงาน" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="เบอร์โทร" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Input
            placeholder="LINE ID (เช่น @service หรือ 0812345678)"
            value={lineId}
            onChange={(e) => setLineId(e.target.value)}
          />
          <Button onClick={add}>
            <Plus className="mr-1 h-4 w-4" /> เพิ่ม
          </Button>
        </div>
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <div
                key={r.id}
                className="grid min-w-0 grid-cols-1 items-center gap-2 rounded-md border p-2 lg:grid-cols-[repeat(3,minmax(0,1fr))_auto]"
              >
                <Input
                  defaultValue={r.name}
                  onBlur={(e) =>
                    e.target.value.trim() && update(r.id, { name: e.target.value.trim() })
                  }
                />
                <Input
                  defaultValue={r.phone ?? ""}
                  placeholder="เบอร์โทร"
                  onBlur={(e) => update(r.id, { phone: e.target.value.trim() || null })}
                />
                <Input
                  defaultValue={r.line_contact ?? ""}
                  placeholder="LINE ID (เช่น @service หรือ 0812345678)"
                  onBlur={(e) => update(r.id, { line_contact: e.target.value.trim() || null })}
                />
                {isAdmin && (
                  <ConfirmButton
                    onConfirm={() => remove(r.id, r.name)}
                    title="ลบพนักงานนี้?"
                    description={`ลบพนักงาน ${r.name} ออกจากระบบใช้งาน (Soft Delete) โดยยังคงรักษาประวัติงานและวันลาย้อนหลังไว้ สามารถกู้คืนได้ที่หน้าถังขยะ`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </ConfirmButton>
                )}
              </div>
            ))}
            {rows.length === 0 && <p className="text-sm text-muted-foreground">ยังไม่มีข้อมูล</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function VehicleCard() {
  const { isAdmin } = useAccess();
  const [rows, setRows] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [plate, setPlate] = useState("");
  const [note, setNote] = useState("");

  const load = async () => {
    const { data } = await supabase.from("vehicles").select("id, plate, note").order("plate");
    setRows((data ?? []) as Vehicle[]);
    refreshDirectory();
    setLoading(false);
  };
  useEffect(() => {
    load();
  }, []);

  const add = async () => {
    if (!plate.trim()) return;
    const { error } = await supabase
      .from("vehicles")
      .insert({ plate: plate.trim(), note: note.trim() || null });
    if (error) return toast.error(error.message);
    setPlate("");
    setNote("");
    toast.success("เพิ่มรถแล้ว");
    load();
  };

  const update = async (id: string, patch: Partial<Vehicle>) => {
    const { error } = await supabase.from("vehicles").update(patch).eq("id", id);
    if (error) toast.error(error.message);
    else refreshDirectory();
  };

  const remove = async (id: string) => {
    const { error } = await deleteAsAdmin("vehicles", { id });
    if (error) return toast.error(error.message);
    toast.success("ลบแล้ว");
    load();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Truck className="h-4 w-4" /> ทะเบียนรถ ({rows.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid min-w-0 grid-cols-1 gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <Input placeholder="ทะเบียนรถ" value={plate} onChange={(e) => setPlate(e.target.value)} />
          <Input placeholder="หมายเหตุ" value={note} onChange={(e) => setNote(e.target.value)} />
          <Button onClick={add}>
            <Plus className="mr-1 h-4 w-4" /> เพิ่ม
          </Button>
        </div>
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <div
                key={r.id}
                className="grid min-w-0 grid-cols-1 items-center gap-2 rounded-md border p-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
              >
                <Input
                  defaultValue={r.plate}
                  onBlur={(e) =>
                    e.target.value.trim() && update(r.id, { plate: e.target.value.trim() })
                  }
                />
                <Input
                  defaultValue={r.note ?? ""}
                  placeholder="หมายเหตุ"
                  onBlur={(e) => update(r.id, { note: e.target.value.trim() || null })}
                />
                {isAdmin && (
                  <ConfirmButton
                    onConfirm={() => remove(r.id)}
                    title="ลบรถคันนี้?"
                    description={`ลบทะเบียน ${r.plate} ออกจากระบบถาวร`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </ConfirmButton>
                )}
              </div>
            ))}
            {rows.length === 0 && <p className="text-sm text-muted-foreground">ยังไม่มีข้อมูล</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
