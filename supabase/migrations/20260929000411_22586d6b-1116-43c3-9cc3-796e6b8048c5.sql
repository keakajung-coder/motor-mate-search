CREATE TABLE public.checklist_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  machine_types text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.checklist_templates TO anon, authenticated;
GRANT ALL ON public.checklist_templates TO service_role;
ALTER TABLE public.checklist_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "checklist read" ON public.checklist_templates FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "checklist insert" ON public.checklist_templates FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "checklist update" ON public.checklist_templates FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_checklist_templates_updated BEFORE UPDATE ON public.checklist_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.appointments ADD COLUMN checklist jsonb;

INSERT INTO public.checklist_templates (name, machine_types, sort_order, items) VALUES
('เช็คลิสต์ปั๊มลมสกรู (มาตรฐาน)', 'สกรู', 0, '[
{"id":"n1","label":"Ambient temperature","kind":"number","fields":[""]},
{"id":"n2","label":"Air at inlet filter","kind":"number","fields":[""]},
{"id":"n3","label":"Air outlet element","kind":"number","fields":[""]},
{"id":"n4","label":"Air outlet after cooler","kind":"number","fields":[""]},
{"id":"n5","label":"Oil into oil cooler","kind":"number","fields":[""]},
{"id":"n6","label":"Oil out of oil cooler","kind":"number","fields":[""]},
{"id":"n7","label":"Motor Hosing","kind":"number","fields":[""]},
{"id":"n8","label":"Amperage","kind":"number","fields":["Load","Unload"]},
{"id":"n9","label":"Volt terminals","kind":"number","fields":["L1","L2","L3"]},
{"id":"n10","label":"Pressure","kind":"number","fields":["Loading","Unloading"]},
{"id":"n11","label":"Load / Unload cycle","kind":"number","fields":[""]},
{"id":"n12","label":"Inspection working hours","kind":"number","fields":["Load","Unload"]},
{"id":"s1","label":"Oil level","kind":"status","fields":[]},
{"id":"s2","label":"Oil filter","kind":"status","fields":[]},
{"id":"s3","label":"Air filter","kind":"status","fields":[]},
{"id":"s4","label":"Oil separator","kind":"status","fields":[]},
{"id":"s5","label":"Intake valve","kind":"status","fields":[]},
{"id":"s6","label":"Solenoid valve intake","kind":"status","fields":[]},
{"id":"s7","label":"Min. Pressure valve","kind":"status","fields":[]},
{"id":"s8","label":"Hose air & oil","kind":"status","fields":[]},
{"id":"s9","label":"Hose oil into cooler","kind":"status","fields":[]},
{"id":"s10","label":"Hose oil out of cooler","kind":"status","fields":[]},
{"id":"s11","label":"Belt / Coupling element","kind":"status","fields":[]},
{"id":"s12","label":"Cooler block","kind":"status","fields":[]},
{"id":"s13","label":"Condensate drain","kind":"status","fields":[]},
{"id":"s14","label":"Compressor motor lubrication","kind":"status","fields":[]},
{"id":"x1","label":"Pressure oil","kind":"status_number","fields":["Load","Unload"]}
]'::jsonb);