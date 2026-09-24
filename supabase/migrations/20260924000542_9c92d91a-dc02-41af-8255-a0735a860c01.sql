ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS cust_id text;
CREATE UNIQUE INDEX IF NOT EXISTS customers_cust_id_key ON public.customers (lower(cust_id)) WHERE cust_id IS NOT NULL AND cust_id <> '';
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS cust_id text;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS cust_id text;