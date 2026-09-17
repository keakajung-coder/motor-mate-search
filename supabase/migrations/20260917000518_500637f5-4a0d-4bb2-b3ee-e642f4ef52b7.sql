ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS line_id text;
ALTER TABLE public.service_staff ADD COLUMN IF NOT EXISTS line_id text;