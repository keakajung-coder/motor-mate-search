ALTER TABLE public.checklist_templates ADD COLUMN IF NOT EXISTS pump_type text;
UPDATE public.checklist_templates SET pump_type = NULLIF(btrim(machine_types), '') WHERE pump_type IS NULL AND machine_types IS NOT NULL AND position(',' in machine_types) = 0;
CREATE INDEX IF NOT EXISTS checklist_templates_pump_type_idx ON public.checklist_templates (pump_type);
COMMENT ON COLUMN public.checklist_templates.pump_type IS 'Pump type matched to compressor_models.pump_type; legacy multi-type templates continue using machine_types.';