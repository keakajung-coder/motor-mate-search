import { SafeBoundary } from "@/components/SafeBoundary";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSuspenseQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useUserRole } from "@/lib/user-role";
import { supabase } from "@/lib/data-client";
import { loadSellerNames } from "@/lib/sellers";
import { isValueRemoved, invalidateData } from "@/lib/data-sync";
import { useAccess } from "@/lib/access";
import { deleteEmployee } from "@/lib/employee-delete";
import { toast } from "sonner";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { LogoutButton } from "@/components/LogoutButton";
import { AddEmployeeButton, EmployeeAdminAuth } from "@/components/EmployeeManagement";
import { BriefcaseBusiness, Wrench, FolderKanban, Users, Search, ChevronRight, ArrowLeft, LayoutGrid, List, Phone, Loader2, RefreshCw, Check, X, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { employeeRole, filterEmployees, type Employee, type Department } from "@/lib/employee-selection";

const departments = [
  { id: "sales", label: "Sales", title: "ฝ่ายขาย", icon: BriefcaseBusiness, color: "text-summary-info", background: "bg-summary-info/10" },
  { id: "service", label: "Service", title: "ฝ่ายบริการ / ช่าง", icon: Wrench, color: "text-summary-success", background: "bg-summary-success/10" },
  { id: "project", label: "Project", title: "การจัดการโปรเจกต์", icon: FolderKanban, color: "text-summary-attention", background: "bg-summary-attention/10" },
  { id: "all", label: "All Overview", title: "ดูได้ทั้งหมด", icon: Users, color: "text-primary", background: "bg-primary/10" },
] as const;

async function loadEmployees(): Promise<Employee[]> {
  const [sales, staff, engineers, sellerNames] = await Promise.all([
    supabase.from("sales_contacts").select("id, name, phone, active, avatar_url, position").eq("active", true).order("name"),
    supabase.from("service_staff").select("id, name, phone, active, avatar_url, position").eq("active", true).order("name"),
    supabase.from("app_settings").select("value").eq("key", "engineers").maybeSingle(),
    loadSellerNames(),
  ]);
  for (const result of [sales, staff, engineers]) if (result.error) throw new Error(result.error.message);
  const result: Employee[] = [];
  for (const row of sales.data ?? []) result.push({ id: `sales:${row.id}`, name: row.name, phone: row.phone ?? "", position: row.position || "ฝ่ายขาย / เซลล์", department: "sales", avatar: row.avatar_url ?? "" });
  for (const name of sellerNames) {
    if (!result.some(e => e.name.toLocaleLowerCase() === name.toLocaleLowerCase())) result.push({ id: `sales:${name}`, name, phone: "", position: "ฝ่ายขาย / เซลล์", department: "sales", avatar: "" });
  }
  for (const row of staff.data ?? []) result.push({ id: `service:${row.id}`, name: row.name, phone: row.phone ?? "", position: row.position || "ช่างบริการ", department: "service", avatar: row.avatar_url ?? "" });
  if (engineers.data?.value) {
    const stored: unknown = JSON.parse(engineers.data.value);
    if (Array.isArray(stored)) for (const item of stored) {
      const row = typeof item === "string" ? { name: item } : item;
      if (!row || typeof row !== "object" || row.active === false || typeof row.name !== "string" || !row.name.trim()) continue;
      result.push({ id: `project:${row.id ?? row.name}`, name: row.name, phone: typeof row.phone === "string" ? row.phone : "", position: typeof row.position === "string" ? row.position : "วิศวกร / โปรเจกต์", department: "project", avatar: typeof row.avatar_url === "string" ? row.avatar_url : "" });
    }
  }
  return result.filter(e => e.name.trim() && !isValueRemoved(e.name)).sort((a, b) => a.name.localeCompare(b.name, "th"));
}
const employeeQuery = { queryKey: ["employee-selection", "service_staff", "sales_contacts", "engineers"], queryFn: loadEmployees, staleTime: 30_000, refetchOnMount: "always" as const, refetchInterval: 15_000 };

function ProfilePicture({ employee, large }: { employee: Employee; large: boolean }) {
  const department = departments.find(d => d.id === employee.department);
  return <Avatar className={cn("rounded-md", large ? "h-24 w-24" : "h-14 w-14")}>
    {employee.avatar && <AvatarImage src={employee.avatar} alt={employee.name} className="object-cover" />}
    <AvatarFallback className={cn("rounded-md font-medium", department?.background, department?.color, large ? "text-3xl" : "text-lg")}>{employee.name.trim().slice(0, 2)}</AvatarFallback>
  </Avatar>;
}

export function RoleSelectionView({ onDone, isModal = false }: { onDone?: () => void; isModal?: boolean }) {
  const [department, setDepartment] = useState<Department | null>(null);
  return <div className="w-full min-w-0" data-no-voice="true">
    <div className="mb-8 flex items-center gap-2 text-xs text-muted-foreground">
      <span className={cn("flex items-center gap-2", !department && "font-medium text-primary")}><span className="flex h-6 w-6 items-center justify-center rounded-full border border-current">1</span>เลือกฝ่าย</span>
      <ChevronRight className="h-3 w-3" />
      <span className={cn("flex items-center gap-2", department && "font-medium text-primary")}><span className="flex h-6 w-6 items-center justify-center rounded-full border border-current">2</span>เลือกพนักงาน</span>
    </div>
    {!department ? <>
      <div className="mb-7"><p className="mb-2 text-xs font-medium uppercase text-primary">Smart Work Planner</p><h1 className="text-2xl font-semibold sm:text-3xl">เลือกฝ่ายของคุณ</h1><p className="mt-2 text-sm text-muted-foreground">ฝ่ายขาย · ฝ่ายบริการ · โปรเจกต์ · ภาพรวมทั้งหมด</p></div>
      <div className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2", !isModal && "xl:grid-cols-4")}>
        {departments.map(d => <Button key={d.id} variant="outline" onClick={() => setDepartment(d.id)} aria-label={`${d.label} ${d.title}`} className="group h-auto min-h-52 w-full flex-col items-start justify-between gap-7 whitespace-normal rounded-lg border bg-card p-6 text-left shadow-none transition-colors hover:border-primary/40 hover:bg-card">
          <div className="flex w-full items-center justify-between"><span className={cn("flex h-12 w-12 items-center justify-center rounded-lg", d.background, d.color)}><d.icon className="h-6 w-6" /></span><ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 motion-reduce:transform-none" /></div>
          <div><h2 className="text-xl font-semibold text-foreground">{d.label}</h2><p className="mt-1 text-sm font-normal text-muted-foreground">{d.title}</p></div>
        </Button>)}
      </div>
    </> : <>
      <Button variant="ghost" size="sm" className="mb-4 gap-2 px-0 text-muted-foreground" onClick={() => setDepartment(null)}><ArrowLeft className="h-4 w-4" />กลับไปเลือกฝ่าย</Button>
      <SafeBoundary label="โหลดรายชื่อพนักงานไม่สำเร็จ"><Suspense fallback={<div className="flex min-h-60 items-center justify-center gap-3 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />กำลังโหลดรายชื่อพนักงาน…</div>}>
        <EmployeeSelection department={department} onDone={onDone} />
      </Suspense></SafeBoundary>
    </>}
  </div>;
}

function EmployeeSelection({ department, onDone }: { department: Department; onDone?: () => void }) {
  const { data: employees } = useSuspenseQuery(employeeQuery);
  const { setRoleAndUser, userName } = useUserRole();
  const { isAdmin } = useAccess();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"list" | "grid">("list");
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);
  const deletion = useMutation({
    mutationFn: async (employee: Employee) => {
      if (!isAdmin) throw new Error("เฉพาะแอดมินเท่านั้นที่ลบพนักงานได้");
      await deleteEmployee(employee);
    },
    onMutate: async (employee) => {
      await queryClient.cancelQueries({ queryKey: employeeQuery.queryKey });
      const previous = queryClient.getQueryData<Employee[]>(employeeQuery.queryKey);
      queryClient.setQueryData<Employee[]>(employeeQuery.queryKey, current => (current ?? []).filter(row => row.id !== employee.id));
      return { previous };
    },
    onError: (error, _employee, context) => {
      if (context?.previous) queryClient.setQueryData(employeeQuery.queryKey, context.previous);
      toast.error(`ลบพนักงานไม่สำเร็จ: ${error.message}`);
    },
    onSuccess: (_result, employee) => {
      setDeleteTarget(null);
      if (userName === employee.name) setRoleAndUser("general", "");
      invalidateData(["service_staff", "sales_contacts", "sellers", "engineers", "directory"]);
      toast.success(`ลบ ${employee.name} ออกจากรายชื่อแล้ว`);
    },
    onSettled: () => { void queryClient.invalidateQueries({ queryKey: employeeQuery.queryKey }); },
  });
  useEffect(() => {
    const refresh = () => { void queryClient.invalidateQueries({ queryKey: employeeQuery.queryKey }); };
    const events = ["app:data-changed", "app:connection-restored", "service-staff-changed", "sales-contacts-changed", "engineers-changed"];
    events.forEach(event => window.addEventListener(event, refresh));
    return () => events.forEach(event => window.removeEventListener(event, refresh));
  }, [queryClient]);
  const filtered = useMemo(() => filterEmployees(employees, department, search).filter(row => !deletion.isPending || row.id !== deletion.variables?.id), [employees, department, search, deletion.isPending, deletion.variables]);
  const info = departments.find(d => d.id === department);
  const select = (employee: Employee) => { setRoleAndUser(employeeRole(employee.department), employee.name); onDone?.(); };
  return <div className="space-y-6 min-w-0">
    <div className="flex flex-wrap justify-end gap-2">
      <EmployeeAdminAuth />
      {isAdmin && <AddEmployeeButton department={department === "all" ? "service" : department} onCreated={employee => {
        setSearch("");
        queryClient.setQueryData<Employee[]>(employeeQuery.queryKey, current => [...(current ?? []).filter(row => row.id !== employee.id), employee].sort((a, b) => a.name.localeCompare(b.name, "th")));
        invalidateData(["service_staff", "sales_contacts", "sellers", "engineers", "directory"]);
      }} />}
    </div>
    <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
      <div><p className={cn("mb-1 text-xs font-medium", info?.color)}>{info?.label} / {info?.title}</p><h1 className="text-2xl font-semibold sm:text-3xl">เลือกพนักงาน</h1></div>
      <div className="relative w-full md:w-80"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="ค้นหาพนักงาน" placeholder="ค้นหาชื่อ เบอร์โทร หรือตำแหน่ง" value={search} onChange={e => setSearch(e.target.value)} className="h-11 rounded-md bg-card pl-10 pr-10" />{search && <Button variant="ghost" size="icon" aria-label="ล้างการค้นหา" className="absolute right-1 top-1 h-9 w-9" onClick={() => setSearch("")}><X className="h-4 w-4" /></Button>}</div>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
      <p className="text-sm text-muted-foreground" aria-live="polite">พนักงาน <span className="font-semibold text-foreground">{filtered.length}</span> คน</p>
      <div className="flex items-center gap-3">
        {department === "all" && <Button variant="ghost" size="sm" className="gap-1 text-primary" onClick={() => { setRoleAndUser("general", ""); onDone?.(); }}>ดูภาพรวมทั้งหมด<ChevronRight className="h-4 w-4" /></Button>}
        <Button variant="ghost" size="icon" title="รีเฟรชรายชื่อ" aria-label="รีเฟรชรายชื่อ" onClick={() => void queryClient.invalidateQueries({ queryKey: employeeQuery.queryKey })}><RefreshCw className="h-4 w-4" /></Button>
        <div className="flex gap-1 rounded-md border bg-card p-1" role="group" aria-label="รูปแบบรายการ">
          <Button variant={view === "list" ? "secondary" : "ghost"} size="icon" className="h-8 w-9 rounded-sm" aria-label="มุมมอง List" title="มุมมอง List" aria-pressed={view === "list"} onClick={() => setView("list")}><List className="h-4 w-4" /></Button>
          <Button variant={view === "grid" ? "secondary" : "ghost"} size="icon" className="h-8 w-9 rounded-sm" aria-label="มุมมอง Grid" title="มุมมอง Grid" aria-pressed={view === "grid"} onClick={() => setView("grid")}><LayoutGrid className="h-4 w-4" /></Button>
        </div>
      </div>
    </div>
    {filtered.length === 0 ? <div className="py-16 text-center"><Users className="mx-auto mb-4 h-9 w-9 text-muted-foreground" /><h2 className="font-medium">{search ? "ไม่พบพนักงานที่ตรงกับการค้นหา" : "ยังไม่มีรายชื่อในฝ่ายนี้"}</h2>{search && <Button variant="ghost" className="mt-2 text-primary" onClick={() => setSearch("")}>ล้างการค้นหา</Button>}</div> : <div className={cn(view === "grid" ? "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" : "divide-y border-y")}>
      {filtered.map(employee => <article key={employee.id} className={cn("min-w-0", view === "grid" ? "flex flex-col items-center gap-4 rounded-lg border bg-card p-6 text-center" : "flex flex-wrap items-center gap-4 py-5")}>
        <ProfilePicture employee={employee} large={view === "grid"} />
        <div className={cn("min-w-0", view === "grid" ? "w-full space-y-2" : "flex-1 space-y-1")}>
          <h2 className="break-words text-base font-semibold">{employee.name}{userName === employee.name && <Check className="ml-2 inline h-4 w-4 text-summary-success" />}</h2>
          <Badge variant="secondary" className={cn("rounded-md px-2 py-1 text-xs font-normal", departments.find(d => d.id === employee.department)?.color)}>{employee.position}</Badge>
          <div className={cn("flex items-center gap-1.5 text-sm text-muted-foreground", view === "grid" && "justify-center")}><Phone className="h-3.5 w-3.5 shrink-0" />{employee.phone ? <a href={`tel:${employee.phone.replace(/[^+\d]/g, "")}`} className="hover:text-primary">{employee.phone}</a> : <span>ยังไม่ระบุเบอร์โทร</span>}</div>
        </div>
        <div className={cn("flex items-center gap-2", view === "grid" ? "mt-auto w-full" : "ml-auto")}>
          <Button variant="outline" disabled={deletion.isPending} className={cn("gap-2 rounded-md text-primary", view === "grid" && "flex-1")} onClick={() => select(employee)} aria-label={`เลือกคนนี้ ${employee.name}`}>เลือกคนนี้<ChevronRight className="h-4 w-4" /></Button>
          {isAdmin && <AddEmployeeButton department={employee.department} employee={employee} onCreated={saved => {
            queryClient.setQueryData<Employee[]>(employeeQuery.queryKey, current => [...(current ?? []).filter(row => row.id !== employee.id && row.id !== saved.id), saved].sort((a, b) => a.name.localeCompare(b.name, "th")));
            if (userName === employee.name) setRoleAndUser(employeeRole(saved.department), saved.name);
            invalidateData(["service_staff", "sales_contacts", "sellers", "engineers", "directory"]);
          }} />}
          {isAdmin && <Button variant="ghost" size="icon" disabled={deletion.isPending} title={`ลบ ${employee.name}`} aria-label={`ลบพนักงาน ${employee.name}`} className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setDeleteTarget(employee)}><Trash2 className="h-4 w-4" /></Button>}
        </div>
      </article>)}
    </div>}
    <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open && !deletion.isPending) setDeleteTarget(null); }}>
      <AlertDialogContent className="z-[100001]" data-no-voice="true">
        <AlertDialogHeader><AlertDialogTitle>ยืนยันลบพนักงาน?</AlertDialogTitle><AlertDialogDescription>ลบ {deleteTarget?.name} ออกจากรายชื่อที่เลือกใช้งาน โดยยังเก็บประวัติงานเดิมไว้</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><Button variant="outline" disabled={deletion.isPending} onClick={() => setDeleteTarget(null)}>ยกเลิก</Button><Button variant="destructive" disabled={deletion.isPending || !isAdmin} onClick={() => { if (deleteTarget && !deletion.isPending) deletion.mutate(deleteTarget); }}>{deletion.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />กำลังลบ…</> : "ยืนยันลบ"}</Button></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>;
}

export function RoleSelectionDialog() {
  const { isSwitching, closeRoleSwitcher } = useUserRole();
  return <Dialog open={isSwitching} onOpenChange={open => !open && closeRoleSwitcher()}>
    <DialogContent data-no-voice="true" className="z-[99999] w-[calc(100vw-1.5rem)] max-w-none max-h-[90dvh] overflow-y-auto rounded-lg bg-background p-5 sm:p-8">
      <DialogTitle className="sr-only">เลือกฝ่ายและพนักงาน</DialogTitle><DialogDescription className="sr-only">Smart Work Planner</DialogDescription>
      <div className="mb-6 flex justify-end pr-7"><LogoutButton /></div>
      <RoleSelectionView onDone={closeRoleSwitcher} isModal />
    </DialogContent>
  </Dialog>;
}

export function RoleSelectionGateScreen() {
  return <div className="min-h-dvh min-w-0 bg-background" data-no-voice="true">
    <header className="border-b bg-card"><div className="flex min-w-0 items-center justify-between gap-3 px-4 py-5 sm:px-8"><div className="flex min-w-0 items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground"><FolderKanban className="h-5 w-5" /></span><span className="text-sm font-semibold sm:text-base">Smart Work Planner</span></div><LogoutButton /></div></header>
    <main className="w-full min-w-0 px-4 py-8 sm:px-8 sm:py-12"><RoleSelectionView /></main>
  </div>;
}
