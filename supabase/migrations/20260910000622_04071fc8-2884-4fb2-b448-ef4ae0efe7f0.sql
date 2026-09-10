ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS sales_rep text;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS sales_rep text;