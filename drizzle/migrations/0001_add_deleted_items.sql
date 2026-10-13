CREATE TABLE public.deleted_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  label text,
  row_data jsonb NOT NULL,
  deleted_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.deleted_items TO service_role;
REVOKE ALL ON public.deleted_items FROM anon, authenticated;
ALTER TABLE public.deleted_items ENABLE ROW LEVEL SECURITY;