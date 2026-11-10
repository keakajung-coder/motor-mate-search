ALTER TABLE public.products ADD COLUMN IF NOT EXISTS cross_reference_parts text[];
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS supported_serials text[];
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS reference_url text;
COMMENT ON COLUMN public.products.cross_reference_parts IS 'รหัสพาร์ทเทียบ / พาร์ททดแทน';
COMMENT ON COLUMN public.products.supported_serials IS 'หมายเลขเครื่อง (S/N) ที่รองรับ';
COMMENT ON COLUMN public.products.is_verified IS 'ตรวจสอบความถูกต้องโดยช่างแล้ว';
COMMENT ON COLUMN public.products.reference_url IS 'URL แหล่งอ้างอิงจากการค้นหา AI';