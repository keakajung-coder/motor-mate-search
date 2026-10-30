ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS cross_zone_approval jsonb;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS cross_zone_approval jsonb;
COMMENT ON COLUMN public.appointments.cross_zone_approval IS 'Server-validated per-vehicle cross-province approval for the assigned visit date';
COMMENT ON COLUMN public.work_orders.cross_zone_approval IS 'Server-validated per-vehicle cross-province approval for the assigned visit date';
ALTER TABLE public.service_contract_visits ADD COLUMN IF NOT EXISTS vehicle_plate text;
CREATE INDEX IF NOT EXISTS appointments_visit_date_zone_idx ON public.appointments(visit_date);
CREATE INDEX IF NOT EXISTS work_orders_visit_date_zone_idx ON public.work_orders(visit_date);
