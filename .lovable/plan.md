# แผน: ค้นหา/ช่วงวันที่ในแพลนเนอร์ + ระบบสัญญาคอนแทรครายปี

## ส่วนที่ 1: แถบค้นหาและช่วงวันที่ในหน้าแพลนเนอร์

ไฟล์หลัก: `src/routes/planner.tsx`

1. เพิ่ม state ใหม่ข้างตัวกรองเดิม (บรรทัด ~370-395): `searchText`, `dateFrom`, `dateTo`
2. เพิ่มเงื่อนไขใน `visible` (บรรทัด ~474-500):
   - `searchText`: ค้นหาแบบ contains (ไม่สนตัวพิมพ์) ใน `customer_name`, `sales_rep`, `staff_name`
   - `dateFrom`/`dateTo`: กรอง `visit_date` ให้อยู่ในช่วง (รองรับเลือกแค่ฝั่งเดียว)
3. เพิ่ม UI ในกลุ่ม controls (บรรทัด ~714-830): ช่องค้นหา + DateInput เริ่ม/สิ้นสุด + ปุ่ม "ล้างตัวกรอง" (รีเซ็ต searchText, dateFrom, dateTo, roleFilter, staffFilter, vehicleFilter)
4. ผลกรองเป็น real-time อยู่แล้วผ่าน useMemo — ใช้ DateInput ตัวเดิมของโปรเจกต์ (portalled Calendar)

## ส่วนที่ 2: ระบบสัญญาคอนแทรครายปี

### ฐานข้อมูล (migration ใหม่ 1 ไฟล์)

- `service_contracts`: id, customer_id, customer_name, machine_unit_id, serial_number, machine_label, visits_per_year (int), start_date, note, active (bool), created_at/updated_at
- `service_contract_visits`: id, contract_id (FK cascade), visit_no (int), visit_date, visit_time, job_detail, parts_note, appointment_id (nullable), work_order_id (nullable), status (scheduled/done/cancelled), created_at/updated_at
- ตามแพทเทิร์นโปรเจกต์: GRANT ALL ให้ service_role, REVOKE anon/authenticated, เปิด RLS ไม่มี policy สาธารณะ (เข้าถึงผ่าน server gateway เท่านั้น)

### Server functions ใหม่: `src/lib/contracts.functions.ts`

- `listContracts` / `saveContract` (admin เขียน, viewer อ่าน) — บันทึกสัญญา + รายการงวด
- เมื่อบันทึก: sync สร้าง/อัปเดต `appointments` ของแต่ละงวดลงแพลนเนอร์ทันที (status scheduled, ผูก appointment_id กลับ)
- `generateDueWorkOrders`: เรียกตอนโหลดหน้าแพลนเนอร์/หน้าสัญญา — งวดที่ถึงกำหนด (visit_date <= วันนี้) และยังไม่มีใบงาน จะสร้าง `work_orders` อัตโนมัติ (billing_type "ในสัญญาบริการ") และผูก work_order_id กลับ
- ใช้ `requireAccess` + `supabaseAdmin` ตามแพทเทิร์น `admin-write.functions.ts`

### UI ใหม่: `src/components/ContractDialog.tsx`

- เปิดจากการ์ดเครื่องจักรหน้าแรก (`src/routes/index.tsx` ~1154) และแท็บเครื่องจักรในหน้าแอดมิน (`src/routes/admin.tsx` ~1444 ข้างช่อง "ติดสัญญาบริการ")
- ฟอร์ม: ลูกค้า/เครื่อง (อัตโนมัติจากเครื่องที่เลือก), จำนวนครั้งต่อปี (พิมพ์เองได้ เช่น 4/6/12) — ใส่แล้วสร้างแถวงวด "ครั้งที่ 1..N" กระจายเท่าๆ กันในรอบปี (แก้วันที่เองได้)
- แต่ละงวดแก้: วันที่, เวลา, รายละเอียดงาน/อะไหล่ แยกอิสระ
- แก้ไขย้อนหลังได้ตลอด: บันทึกซ้ำจะอัปเดต appointments/work_orders ที่ผูกไว้

### การทดสอบ

- เพิ่มเทสต์ตรรกะกระจายงวด (จำนวนครั้ง → วันที่ในรอบปี) ใน `src/lib/contract-schedule.ts` + `.test.ts`
- รัน bun test + ตรวจ build

## ข้อจำกัดที่คงไว้

- การเขียนข้อมูลสัญญาเป็นสิทธิ์แอดมิน (ตามนโยบายความปลอดภัยเดิม); viewer ดูได้อย่างเดียว
- ไม่แตะรหัสผ่าน/สิทธิ์เดิม
