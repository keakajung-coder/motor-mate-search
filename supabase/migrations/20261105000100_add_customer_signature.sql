ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS customer_signature text;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS customer_signer_name text;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS customer_signed_at timestamptz;

ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS customer_signature text;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS customer_signer_name text;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS customer_signed_at timestamptz;

