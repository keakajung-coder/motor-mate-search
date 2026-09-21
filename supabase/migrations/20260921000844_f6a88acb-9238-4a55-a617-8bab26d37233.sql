ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS attachments text;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS attachments text;

CREATE POLICY job_attachments_read ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'job-attachments');
CREATE POLICY job_attachments_insert ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'job-attachments' AND (storage.foldername(name))[1] = 'jobs');
CREATE POLICY job_attachments_delete ON storage.objects FOR DELETE TO anon, authenticated
  USING (bucket_id = 'job-attachments' AND (storage.foldername(name))[1] = 'jobs');