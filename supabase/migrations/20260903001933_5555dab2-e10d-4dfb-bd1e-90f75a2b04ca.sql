ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS job_no text,
  ADD COLUMN IF NOT EXISTS priority text,
  ADD COLUMN IF NOT EXISTS billing_type text,
  ADD COLUMN IF NOT EXISTS po_number text,
  ADD COLUMN IF NOT EXISTS billing_note text,
  ADD COLUMN IF NOT EXISTS work_types text,
  ADD COLUMN IF NOT EXISTS depart_time text,
  ADD COLUMN IF NOT EXISTS return_time text,
  ADD COLUMN IF NOT EXISTS logistics_note text,
  ADD COLUMN IF NOT EXISTS safety_gear text;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS job_no text,
  ADD COLUMN IF NOT EXISTS priority text,
  ADD COLUMN IF NOT EXISTS billing_type text,
  ADD COLUMN IF NOT EXISTS po_number text,
  ADD COLUMN IF NOT EXISTS billing_note text,
  ADD COLUMN IF NOT EXISTS work_types text,
  ADD COLUMN IF NOT EXISTS depart_time text,
  ADD COLUMN IF NOT EXISTS return_time text,
  ADD COLUMN IF NOT EXISTS logistics_note text,
  ADD COLUMN IF NOT EXISTS safety_gear text,
  ADD COLUMN IF NOT EXISTS quotation_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS parts_categories text,
  ADD COLUMN IF NOT EXISTS parts_note text;