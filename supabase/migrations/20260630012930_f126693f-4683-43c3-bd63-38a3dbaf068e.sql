
-- customers
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  address text,
  note text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
GRANT SELECT ON public.customers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read customers" ON public.customers FOR SELECT TO anon USING (true);
CREATE POLICY "auth all customers" ON public.customers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_customers_updated BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- machine units (เครื่องของลูกค้า เก็บ serial number)
CREATE TABLE public.machine_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  serial_number text NOT NULL UNIQUE,
  model_id uuid REFERENCES public.compressor_models(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  install_date date,
  note text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
GRANT SELECT ON public.machine_units TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.machine_units TO authenticated;
GRANT ALL ON public.machine_units TO service_role;
ALTER TABLE public.machine_units ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read machine_units" ON public.machine_units FOR SELECT TO anon USING (true);
CREATE POLICY "auth all machine_units" ON public.machine_units FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_machine_units_sn ON public.machine_units(serial_number);
CREATE TRIGGER trg_machine_units_updated BEFORE UPDATE ON public.machine_units FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- รายการอะไหล่ประจำเครื่อง
CREATE TABLE public.machine_parts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_unit_id uuid NOT NULL REFERENCES public.machine_units(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1,
  note text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(machine_unit_id, product_id)
);
GRANT SELECT ON public.machine_parts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.machine_parts TO authenticated;
GRANT ALL ON public.machine_parts TO service_role;
ALTER TABLE public.machine_parts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read machine_parts" ON public.machine_parts FOR SELECT TO anon USING (true);
CREATE POLICY "auth all machine_parts" ON public.machine_parts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_machine_parts_unit ON public.machine_parts(machine_unit_id);
CREATE TRIGGER trg_machine_parts_updated BEFORE UPDATE ON public.machine_parts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- sort_order ให้ categories
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;

-- seed หมวดอะไหล่
INSERT INTO public.categories (name, sort_order) VALUES
('กรองอากาศ', 1),
('กรองน้ำมัน', 2),
('น้ำมัน', 3),
('ตัวแยกน้ำมัน', 4),
('ประเก็นตัวแยกน้ำมัน', 5),
('สายพาน', 6),
('ชุดอะไหล่อินเทควาล์ว', 7),
('ชุดอะไหล่ควบคุมอินเทควาล์ว', 8),
('โซลีนอยวาล์ว', 9),
('มินิมั่มวาล์ว', 10)
ON CONFLICT DO NOTHING;
