CREATE TABLE public.repair_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  contact_person text,
  contact_phone text,
  sales_person text,
  equipment_model text,
  serial_number text,
  issue_description text,
  check_in_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','In Progress','Waiting Parts','Ready','Completed')),
  next_action text,
  assigned_tech text,
  target_delivery_date date,
  actual_delivery_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.repair_orders TO service_role;
REVOKE ALL ON public.repair_orders FROM anon, authenticated;
ALTER TABLE public.repair_orders ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER set_repair_orders_updated_at BEFORE UPDATE ON public.repair_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();