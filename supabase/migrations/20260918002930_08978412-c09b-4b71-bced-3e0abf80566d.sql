CREATE TABLE public.sales_contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kind text NOT NULL DEFAULT 'sales',
  name text NOT NULL,
  company text,
  phone text,
  line_contact text,
  line_id text,
  note text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_contacts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.sales_contacts TO anon;
GRANT ALL ON public.sales_contacts TO service_role;

ALTER TABLE public.sales_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth all sales_contacts" ON public.sales_contacts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon read sales_contacts" ON public.sales_contacts FOR SELECT TO anon USING (true);
CREATE POLICY "anon insert sales_contacts" ON public.sales_contacts FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon update sales_contacts" ON public.sales_contacts FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE TRIGGER update_sales_contacts_updated_at BEFORE UPDATE ON public.sales_contacts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();