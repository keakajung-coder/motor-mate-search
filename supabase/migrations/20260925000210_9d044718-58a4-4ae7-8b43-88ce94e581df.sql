CREATE OR REPLACE FUNCTION public.replace_name_in_list(_list text, _old text, _new text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE WHEN _list IS NULL THEN NULL ELSE
    array_to_string(ARRAY(
      SELECT CASE WHEN lower(trim(x)) = lower(trim(_old)) THEN trim(_new) ELSE trim(x) END
      FROM unnest(string_to_array(_list, ',')) AS x WHERE trim(x) <> ''
    ), ', ') END
$$;

CREATE OR REPLACE FUNCTION public.cascade_customer_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.name IS DISTINCT FROM OLD.name THEN
    UPDATE work_orders SET customer_name = NEW.name WHERE customer_name = OLD.name;
    UPDATE appointments SET customer_name = NEW.name WHERE customer_name = OLD.name;
  END IF;
  IF NEW.cust_id IS DISTINCT FROM OLD.cust_id THEN
    UPDATE work_orders SET cust_id = NEW.cust_id
      WHERE (OLD.cust_id IS NOT NULL AND cust_id = OLD.cust_id) OR customer_name = NEW.name;
    UPDATE appointments SET cust_id = NEW.cust_id
      WHERE (OLD.cust_id IS NOT NULL AND cust_id = OLD.cust_id) OR customer_name = NEW.name;
  END IF;
  IF NEW.address IS DISTINCT FROM OLD.address AND OLD.address IS NOT NULL THEN
    UPDATE work_orders SET customer_address = NEW.address WHERE customer_name = NEW.name AND customer_address = OLD.address;
    UPDATE appointments SET customer_address = NEW.address WHERE customer_name = NEW.name AND customer_address = OLD.address;
  END IF;
  IF NEW.phone IS DISTINCT FROM OLD.phone AND OLD.phone IS NOT NULL THEN
    UPDATE work_orders SET contact_phone = NEW.phone WHERE customer_name = NEW.name AND contact_phone = OLD.phone;
    UPDATE appointments SET contact_phone = NEW.phone WHERE customer_name = NEW.name AND contact_phone = OLD.phone;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_cascade_customer AFTER UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.cascade_customer_update();

CREATE OR REPLACE FUNCTION public.cascade_vehicle_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.plate IS DISTINCT FROM OLD.plate THEN
    UPDATE work_orders SET vehicle_plate = replace_name_in_list(vehicle_plate, OLD.plate, NEW.plate) WHERE vehicle_plate ILIKE '%' || OLD.plate || '%';
    UPDATE appointments SET vehicle_plate = replace_name_in_list(vehicle_plate, OLD.plate, NEW.plate) WHERE vehicle_plate ILIKE '%' || OLD.plate || '%';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_cascade_vehicle AFTER UPDATE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.cascade_vehicle_update();

CREATE OR REPLACE FUNCTION public.cascade_staff_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.name IS DISTINCT FROM OLD.name THEN
    UPDATE work_orders SET staff_name = replace_name_in_list(staff_name, OLD.name, NEW.name) WHERE staff_name ILIKE '%' || OLD.name || '%';
    UPDATE appointments SET staff_name = replace_name_in_list(staff_name, OLD.name, NEW.name) WHERE staff_name ILIKE '%' || OLD.name || '%';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_cascade_staff AFTER UPDATE ON public.service_staff FOR EACH ROW EXECUTE FUNCTION public.cascade_staff_update();

CREATE OR REPLACE FUNCTION public.cascade_seller_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.name IS DISTINCT FROM OLD.name THEN
    UPDATE work_orders SET sales_rep = NEW.name WHERE sales_rep = OLD.name;
    UPDATE appointments SET sales_rep = NEW.name WHERE sales_rep = OLD.name;
    UPDATE machine_units SET seller = NEW.name WHERE seller = OLD.name;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_cascade_seller AFTER UPDATE ON public.sales_contacts FOR EACH ROW EXECUTE FUNCTION public.cascade_seller_update();

CREATE OR REPLACE FUNCTION public.cascade_serial_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.serial_number IS DISTINCT FROM OLD.serial_number THEN
    UPDATE work_orders SET serial_number = replace_name_in_list(serial_number, OLD.serial_number, NEW.serial_number) WHERE serial_number ILIKE '%' || OLD.serial_number || '%';
    UPDATE appointments SET serial_number = replace_name_in_list(serial_number, OLD.serial_number, NEW.serial_number) WHERE serial_number ILIKE '%' || OLD.serial_number || '%';
    UPDATE maintenance_logs SET serial_number = NEW.serial_number WHERE serial_number = OLD.serial_number;
  END IF;
  IF NEW.customer_sn IS DISTINCT FROM OLD.customer_sn AND OLD.customer_sn IS NOT NULL THEN
    UPDATE work_orders SET customer_sn = NEW.customer_sn WHERE customer_sn = OLD.customer_sn;
    UPDATE appointments SET customer_sn = NEW.customer_sn WHERE customer_sn = OLD.customer_sn;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_cascade_serial AFTER UPDATE ON public.machine_units FOR EACH ROW EXECUTE FUNCTION public.cascade_serial_update();

CREATE OR REPLACE FUNCTION public.cascade_brand_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.name IS DISTINCT FROM OLD.name THEN
    UPDATE work_orders SET machine_label = regexp_replace(machine_label, '(^|,\s*)' || OLD.name || '(\s|$)', '\1' || NEW.name || '\2', 'g')
      WHERE machine_label ILIKE '%' || OLD.name || '%';
    UPDATE appointments SET machine_label = regexp_replace(machine_label, '(^|,\s*)' || OLD.name || '(\s|$)', '\1' || NEW.name || '\2', 'g')
      WHERE machine_label ILIKE '%' || OLD.name || '%';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_cascade_brand AFTER UPDATE ON public.brands FOR EACH ROW EXECUTE FUNCTION public.cascade_brand_update();

CREATE OR REPLACE FUNCTION public.cascade_model_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b text; o text; n text;
BEGIN
  IF NEW.name IS DISTINCT FROM OLD.name THEN
    SELECT name INTO b FROM brands WHERE id = NEW.brand_id;
    o := trim(coalesce(b,'') || ' ' || OLD.name);
    n := trim(coalesce(b,'') || ' ' || NEW.name);
    UPDATE work_orders SET machine_label = replace(machine_label, o, n) WHERE machine_label LIKE '%' || o || '%';
    UPDATE appointments SET machine_label = replace(machine_label, o, n) WHERE machine_label LIKE '%' || o || '%';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_cascade_model AFTER UPDATE ON public.compressor_models FOR EACH ROW EXECUTE FUNCTION public.cascade_model_update();

REVOKE EXECUTE ON FUNCTION public.cascade_customer_update(), public.cascade_vehicle_update(), public.cascade_staff_update(), public.cascade_seller_update(), public.cascade_serial_update(), public.cascade_brand_update(), public.cascade_model_update() FROM PUBLIC, anon, authenticated;