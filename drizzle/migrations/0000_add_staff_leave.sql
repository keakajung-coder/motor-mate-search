CREATE TABLE public.staff_leave (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 staff_id uuid REFERENCES public.service_staff(id) ON DELETE SET NULL,
 staff_name text NOT NULL,
 leave_date date NOT NULL,
 period text NOT NULL CHECK (period IN ('full','am','pm')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (staff_id, leave_date)
);
GRANT ALL ON public.staff_leave TO service_role;
REVOKE ALL ON public.staff_leave FROM anon, authenticated;
ALTER TABLE public.staff_leave ENABLE ROW LEVEL SECURITY;
CREATE INDEX staff_leave_date_idx ON public.staff_leave(leave_date);
CREATE TRIGGER staff_leave_updated BEFORE UPDATE ON public.staff_leave FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();