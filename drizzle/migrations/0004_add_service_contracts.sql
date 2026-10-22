CREATE TABLE public.service_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  machine_unit_id uuid REFERENCES public.machine_units(id) ON DELETE SET NULL,
  serial_number text,
  machine_label text,
  visits_per_year integer NOT NULL DEFAULT 4,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  note text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.service_contracts TO service_role;
REVOKE ALL ON public.service_contracts FROM anon, authenticated;
ALTER TABLE public.service_contracts ENABLE ROW LEVEL SECURITY;
CREATE INDEX service_contracts_machine_idx ON public.service_contracts(machine_unit_id);
CREATE TRIGGER service_contracts_updated BEFORE UPDATE ON public.service_contracts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.service_contract_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.service_contracts(id) ON DELETE CASCADE,
  visit_no integer NOT NULL,
  visit_date date NOT NULL,
  visit_time text,
  job_detail text,
  parts_note text,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  work_order_id uuid REFERENCES public.work_orders(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'scheduled',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contract_id, visit_no)
);
GRANT ALL ON public.service_contract_visits TO service_role;
REVOKE ALL ON public.service_contract_visits FROM anon, authenticated;
ALTER TABLE public.service_contract_visits ENABLE ROW LEVEL SECURITY;
CREATE INDEX service_contract_visits_date_idx ON public.service_contract_visits(visit_date);
CREATE TRIGGER service_contract_visits_updated BEFORE UPDATE ON public.service_contract_visits FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();