ALTER TABLE public.machine_units
  ADD COLUMN IF NOT EXISTS warranty_end date,
  ADD COLUMN IF NOT EXISTS contract_service boolean NOT NULL DEFAULT false;