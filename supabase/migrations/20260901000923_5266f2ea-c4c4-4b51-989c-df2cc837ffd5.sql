CREATE TABLE public.part_bundles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.part_bundles TO anon, authenticated;
GRANT ALL ON public.part_bundles TO service_role;
ALTER TABLE public.part_bundles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon all part_bundles" ON public.part_bundles FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "auth all part_bundles" ON public.part_bundles FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.part_bundle_items (
  id uuid primary key default gen_random_uuid(),
  bundle_id uuid not null references public.part_bundles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity integer not null default 1,
  created_at timestamptz not null default now(),
  unique (bundle_id, product_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.part_bundle_items TO anon, authenticated;
GRANT ALL ON public.part_bundle_items TO service_role;
ALTER TABLE public.part_bundle_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon all part_bundle_items" ON public.part_bundle_items FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "auth all part_bundle_items" ON public.part_bundle_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_part_bundles_updated_at BEFORE UPDATE ON public.part_bundles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.troubleshooting_issues ADD COLUMN IF NOT EXISTS answered_at timestamptz;