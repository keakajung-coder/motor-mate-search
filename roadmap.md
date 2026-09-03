# Roadmap

- [x] แก้ finding: business_tables_anon_write_access — ตัดสิทธิ์ anon แบบ ALL เหลือ SELECT/INSERT/UPDATE, การลบผ่าน server fn ตรวจรหัสแอดมิน (adminDelete) ทุกหน้า
- [x] แก้ finding: customers_public_exposure — เหลือ SELECT เท่านั้นสำหรับ anon
- [x] แก้ finding: storage_objects_no_rls_policies — เพิ่ม policy SELECT/INSERT ให้ product-images, ปิด UPDATE/DELETE
- [x] ปฏิทิน: ความกว้างคอลัมน์ จ–ศ 17.4% / ส 10% / อา 3% แถบแดง + scroll แนวนอน
- [x] การ์ดนัดหมาย: ขอบ 3px ตามรถ, พื้นพาสเทลตามช่าง, ตัวหนังสือ slate-800
- [x] มุมมองเดือน: แสดงเฉพาะชื่อลูกค้า, cell scroll แนวตั้ง max-h-24
- [x] มุมมองสัปดาห์: แบ่งเช้า/บ่าย + แถบพักเที่ยง, การ์ดมีเวลา+ชื่อช่าง/ลูกค้า Bold/รายละเอียด
