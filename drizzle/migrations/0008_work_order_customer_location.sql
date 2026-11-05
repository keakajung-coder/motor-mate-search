ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS customer_location jsonb;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS customer_location jsonb;
COMMENT ON COLUMN public.work_orders.customer_location IS 'Customer address and Maps snapshot selected for this job; kept separately from customer history.';
COMMENT ON COLUMN public.appointments.customer_location IS 'Customer address and Maps snapshot carried from the work order or queue form.';