import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { deleteAsAdmin } from "@/lib/access";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ConfirmButton";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Truck, UserCog } from "lucide-react";

type Staff = { id: string; name: string; phone: string | null; line_id: string | null };
type Vehicle = { id: string; plate: string; note: string | null };

export function StaffVehiclesTab() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <StaffCard />
      <VehicleCard />
    </div>
  );
}

function StaffCard() {
  const [rows, setRows] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [lineId, setLineId] = useState("");

  const load = async () => {
    const { data } = await supabase.from("service_staff").select("id, name, phone, line_id").order("name");
    setRows((data ?? []) as Staff[]);
    setLoading(false);
  };
  useEffect(() => {
    load();
  }, []);

  const add = async () => {
    if (!name.trim()) return;
    const { error } = await supabase
      .from("service_staff")
      .insert({ name: name.trim(), phone: phone.trim() || null, line_id: lineId.trim() || null });
    if (error) return toast.error(error.message);
    setName("");
    setPhone("");
    setLineId("");
    toast.success("เพิ่มพนักงานแล้ว");
    load();
  };

  const update = async (id: string, patch: Partial<Staff>) => {
    const { error } = await supabase.from("service_staff").update(patch).eq("id", id);
    if (error) toast.error(error.message);
  };

  const remove = async (id: string) => {
    const { error } = await deleteAsAdmin("service_staff", { id });
    if (error) return toast.error(error.message);
    toast.success("ลบแล้ว");
    load();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <UserCog className="h-4 w-4" /> พนักงานเซอร์วิส ({rows.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Input className="min-w-40 flex-1" placeholder="ชื่อพนักงาน" value={name} onChange={(e) => setName(e.target.value)} />
          <Input className="w-36" placeholder="เบอร์โทร" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Input
            className="w-44"
            placeholder="LINE ID / เบอร์ LINE"
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
              <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-md border p-2">
                <Input
                  className="flex-1"
                  defaultValue={r.name}
                  onBlur={(e) => e.target.value.trim() && update(r.id, { name: e.target.value.trim() })}
                />
                <Input
                  className="w-32"
                  defaultValue={r.phone ?? ""}
                  placeholder="เบอร์โทร"
                  onBlur={(e) => update(r.id, { phone: e.target.value.trim() || null })}
                />
                <ConfirmButton onConfirm={() => remove(r.id)} description={`ลบพนักงาน ${r.name}?`}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </ConfirmButton>
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
  const [rows, setRows] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [plate, setPlate] = useState("");
  const [note, setNote] = useState("");

  const load = async () => {
    const { data } = await supabase.from("vehicles").select("id, plate, note").order("plate");
    setRows((data ?? []) as Vehicle[]);
    setLoading(false);
  };
  useEffect(() => {
    load();
  }, []);

  const add = async () => {
    if (!plate.trim()) return;
    const { error } = await supabase.from("vehicles").insert({ plate: plate.trim(), note: note.trim() || null });
    if (error) return toast.error(error.message);
    setPlate("");
    setNote("");
    toast.success("เพิ่มรถแล้ว");
    load();
  };

  const update = async (id: string, patch: Partial<Vehicle>) => {
    const { error } = await supabase.from("vehicles").update(patch).eq("id", id);
    if (error) toast.error(error.message);
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
        <div className="flex flex-wrap gap-2">
          <Input className="w-36" placeholder="ทะเบียนรถ" value={plate} onChange={(e) => setPlate(e.target.value)} />
          <Input className="min-w-32 flex-1" placeholder="หมายเหตุ" value={note} onChange={(e) => setNote(e.target.value)} />
          <Button onClick={add}>
            <Plus className="mr-1 h-4 w-4" /> เพิ่ม
          </Button>
        </div>
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.id} className="flex items-center gap-2 rounded-md border p-2">
                <Input
                  className="w-36"
                  defaultValue={r.plate}
                  onBlur={(e) => e.target.value.trim() && update(r.id, { plate: e.target.value.trim() })}
                />
                <Input
                  className="flex-1"
                  defaultValue={r.note ?? ""}
                  placeholder="หมายเหตุ"
                  onBlur={(e) => update(r.id, { note: e.target.value.trim() || null })}
                />
                <ConfirmButton onConfirm={() => remove(r.id)} description={`ลบทะเบียน ${r.plate}?`}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </ConfirmButton>
              </div>
            ))}
            {rows.length === 0 && <p className="text-sm text-muted-foreground">ยังไม่มีข้อมูล</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
