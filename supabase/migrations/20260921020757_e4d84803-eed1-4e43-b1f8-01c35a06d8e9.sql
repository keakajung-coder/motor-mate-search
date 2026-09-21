UPDATE public.work_orders SET status = 'approved', updated_at = now() WHERE status = 'scheduled';
UPDATE public.appointments SET status = 'approved', updated_at = now() WHERE status = 'scheduled';