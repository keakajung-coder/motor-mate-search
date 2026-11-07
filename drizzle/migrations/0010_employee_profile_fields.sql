ALTER TABLE public.service_staff ADD COLUMN IF NOT EXISTS avatar_url text, ADD COLUMN IF NOT EXISTS position text;
ALTER TABLE public.sales_contacts ADD COLUMN IF NOT EXISTS avatar_url text, ADD COLUMN IF NOT EXISTS position text;
ALTER TABLE public.service_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_contacts ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.service_staff, public.sales_contacts TO service_role;
REVOKE ALL ON public.service_staff, public.sales_contacts FROM anon, authenticated;