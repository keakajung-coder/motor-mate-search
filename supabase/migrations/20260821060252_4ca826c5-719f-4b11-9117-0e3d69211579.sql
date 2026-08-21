-- 1) security settings (server-only)
CREATE TABLE public.security_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.security_settings TO service_role;
ALTER TABLE public.security_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role manages security settings" ON public.security_settings FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER trg_security_settings_updated BEFORE UPDATE ON public.security_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
INSERT INTO public.security_settings (key, value) VALUES ('viewer_passcode', '5555'), ('admin_passcode', '1234');

-- 2) service staff
CREATE TABLE public.service_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_staff TO anon, authenticated;
GRANT ALL ON public.service_staff TO service_role;
ALTER TABLE public.service_staff ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon all service_staff" ON public.service_staff FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "auth all service_staff" ON public.service_staff FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_service_staff_updated BEFORE UPDATE ON public.service_staff FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) vehicles
CREATE TABLE public.vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plate text NOT NULL,
  note text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicles TO anon, authenticated;
GRANT ALL ON public.vehicles TO service_role;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon all vehicles" ON public.vehicles FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "auth all vehicles" ON public.vehicles FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_vehicles_updated BEFORE UPDATE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) work orders
CREATE TABLE public.work_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name text NOT NULL,
  customer_address text,
  contact_name text,
  contact_phone text,
  machine_label text,
  serial_number text,
  job_detail text,
  service_type text,
  visit_date date,
  visit_time text,
  staff_name text,
  vehicle_plate text,
  status text NOT NULL DEFAULT 'pending',
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_orders TO anon, authenticated;
GRANT ALL ON public.work_orders TO service_role;
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon all work_orders" ON public.work_orders FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "auth all work_orders" ON public.work_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_work_orders_updated BEFORE UPDATE ON public.work_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) appointments
CREATE TABLE public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid REFERENCES public.work_orders(id) ON DELETE SET NULL,
  machine_unit_id uuid REFERENCES public.machine_units(id) ON DELETE SET NULL,
  customer_name text,
  customer_address text,
  contact_name text,
  contact_phone text,
  machine_label text,
  serial_number text,
  job_detail text,
  service_type text,
  visit_date date NOT NULL,
  visit_time text,
  staff_name text,
  vehicle_plate text,
  status text NOT NULL DEFAULT 'scheduled',
  result text,
  close_note text,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO anon, authenticated;
GRANT ALL ON public.appointments TO service_role;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon all appointments" ON public.appointments FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "auth all appointments" ON public.appointments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_appointments_updated BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_appointments_date ON public.appointments (visit_date);

-- 6) maintenance logs
CREATE TABLE public.maintenance_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_unit_id uuid REFERENCES public.machine_units(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  serial_number text,
  job_detail text,
  service_type text,
  result text,
  note text,
  done_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.maintenance_logs TO anon, authenticated;
GRANT ALL ON public.maintenance_logs TO service_role;
ALTER TABLE public.maintenance_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon all maintenance_logs" ON public.maintenance_logs FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "auth all maintenance_logs" ON public.maintenance_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_maintenance_logs_updated BEFORE UPDATE ON public.maintenance_logs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7) machine data completeness flag
ALTER TABLE public.machine_units ADD COLUMN IF NOT EXISTS data_complete boolean NOT NULL DEFAULT false;