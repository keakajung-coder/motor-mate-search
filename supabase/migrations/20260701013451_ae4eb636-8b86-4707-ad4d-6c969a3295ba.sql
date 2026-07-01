
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS storage_location text,
  ADD COLUMN IF NOT EXISTS service_interval_hours integer;

ALTER TABLE public.machine_units
  ADD COLUMN IF NOT EXISTS daily_hours numeric;

ALTER TABLE public.machine_parts
  ADD COLUMN IF NOT EXISTS hours_used numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_changed_at date,
  ADD COLUMN IF NOT EXISTS service_interval_hours integer;

CREATE TABLE IF NOT EXISTS public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO anon, authenticated;
GRANT ALL ON public.app_settings TO service_role;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon all app_settings" ON public.app_settings FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "auth all app_settings" ON public.app_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.app_settings (key, value) VALUES
  ('line_url', 'https://line.me/'),
  ('purchase_contact', '')
ON CONFLICT (key) DO NOTHING;

DROP TRIGGER IF EXISTS update_app_settings_updated_at ON public.app_settings;
CREATE TRIGGER update_app_settings_updated_at BEFORE UPDATE ON public.app_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
