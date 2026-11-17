CREATE OR REPLACE FUNCTION public.sync_appointment_edit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.work_order_id IS NOT NULL AND (
     NEW.visit_date IS DISTINCT FROM OLD.visit_date OR NEW.visit_time IS DISTINCT FROM OLD.visit_time
     OR NEW.staff_name IS DISTINCT FROM OLD.staff_name OR NEW.vehicle_plate IS DISTINCT FROM OLD.vehicle_plate
     OR NEW.sales_rep IS DISTINCT FROM OLD.sales_rep OR NEW.job_detail IS DISTINCT FROM OLD.job_detail) THEN
    UPDATE work_orders SET visit_date = NEW.visit_date, visit_time = NEW.visit_time, staff_name = NEW.staff_name,
      vehicle_plate = NEW.vehicle_plate, sales_rep = NEW.sales_rep, job_detail = NEW.job_detail
    WHERE id = NEW.work_order_id;
  END IF;
  IF NEW.visit_date IS DISTINCT FROM OLD.visit_date OR NEW.visit_time IS DISTINCT FROM OLD.visit_time
     OR NEW.vehicle_plate IS DISTINCT FROM OLD.vehicle_plate THEN
    UPDATE service_contract_visits SET visit_date = NEW.visit_date, visit_time = NEW.visit_time, vehicle_plate = NEW.vehicle_plate
    WHERE appointment_id = NEW.id AND status NOT IN ('done','closed','cancelled');
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.sync_appointment_edit() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_sync_appointment_edit ON public.appointments;
CREATE TRIGGER trg_sync_appointment_edit AFTER UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.sync_appointment_edit();