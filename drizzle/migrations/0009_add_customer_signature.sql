ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS customer_signature text;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS customer_signer_name text;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS customer_signed_at timestamptz;

ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS customer_signature text;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS customer_signer_name text;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS customer_signed_at timestamptz;

COMMENT ON COLUMN public.appointments.customer_signature IS 'Base64 data URL of customer signature at job completion';
COMMENT ON COLUMN public.appointments.customer_signer_name IS 'Name of customer signee / receiver';
COMMENT ON COLUMN public.appointments.customer_signed_at IS 'Timestamp when customer signed at job completion';

