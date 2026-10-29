ALTER TABLE public.service_contract_visits ADD COLUMN IF NOT EXISTS vehicle_plate text;
COMMENT ON COLUMN public.service_contract_visits.vehicle_plate IS 'Vehicle license plate assigned to this contract visit';
