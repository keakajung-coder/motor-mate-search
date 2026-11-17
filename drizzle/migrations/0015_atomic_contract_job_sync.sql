CREATE OR REPLACE FUNCTION public.sync_contract_jobs(p_contract_id uuid DEFAULT NULL, p_due_only boolean DEFAULT true)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
 v record; c public.service_contracts%ROWTYPE; m public.machine_units%ROWTYPE; cu public.customers%ROWTYPE;
 a public.appointments%ROWTYPE; w public.work_orders%ROWTYPE;
 aid uuid; wid uuid; sn text; cname text; seller_name text; label text; addr text; loc jsonb; target text; jobnumber text;
 created_count integer := 0; linked_count integer := 0;
BEGIN
 FOR v IN SELECT sv.* FROM public.service_contract_visits sv JOIN public.service_contracts sc ON sc.id=sv.contract_id
   WHERE sc.active AND (p_contract_id IS NULL OR sc.id=p_contract_id)
   AND sv.status NOT IN ('done','closed','cancelled')
   AND (NOT p_due_only OR sv.visit_date <= (now() AT TIME ZONE 'Asia/Bangkok')::date)
   ORDER BY sv.visit_date, sv.id
 LOOP
  SELECT * INTO c FROM public.service_contracts WHERE id=v.contract_id;
  SELECT * INTO m FROM public.machine_units WHERE id=c.machine_unit_id;
  IF m.id IS NULL AND NULLIF(trim(c.serial_number),'') IS NOT NULL THEN
    SELECT * INTO m FROM public.machine_units WHERE serial_number=c.serial_number LIMIT 1;
  END IF;
  SELECT * INTO cu FROM public.customers WHERE id=COALESCE(c.customer_id,m.customer_id);
  sn := COALESCE(NULLIF(trim(m.serial_number),''),NULLIF(trim(c.serial_number),''));
  cname := COALESCE(NULLIF(cu.name,''),c.customer_name);
  seller_name := m.seller;
  label := c.machine_label;
  IF NULLIF(label,'') IS NULL AND m.model_id IS NOT NULL THEN
    SELECT concat_ws(' ',b.name,cm.name) INTO label FROM public.compressor_models cm LEFT JOIN public.brands b ON b.id=cm.brand_id WHERE cm.id=m.model_id;
  END IF;
  addr := concat_ws(' ',COALESCE(NULLIF(m.address_line,''),NULLIF(cu.address,'')),
    CASE WHEN NULLIF(m.address_line,'') IS NULL AND NULLIF(cu.subdistrict,'') IS NOT NULL AND position(cu.subdistrict IN COALESCE(cu.address,''))=0 THEN 'ต.'||cu.subdistrict END,
    CASE WHEN NULLIF(COALESCE(NULLIF(m.district,''),cu.district),'') IS NOT NULL AND position(COALESCE(NULLIF(m.district,''),cu.district) IN COALESCE(NULLIF(m.address_line,''),cu.address,''))=0 THEN 'อ.'||COALESCE(NULLIF(m.district,''),cu.district) END,
    CASE WHEN NULLIF(COALESCE(NULLIF(m.province,''),cu.province),'') IS NOT NULL AND position(COALESCE(NULLIF(m.province,''),cu.province) IN COALESCE(NULLIF(m.address_line,''),cu.address,''))=0 THEN 'จ.'||COALESCE(NULLIF(m.province,''),cu.province) END,
    CASE WHEN NULLIF(cu.postal_code,'') IS NOT NULL AND position(cu.postal_code IN COALESCE(cu.address,''))=0 THEN cu.postal_code END);
  loc := jsonb_build_object('address',COALESCE(NULLIF(m.address_line,''),cu.address,''),'subdistrict',COALESCE(cu.subdistrict,''),'district',COALESCE(NULLIF(m.district,''),cu.district,''),'province',COALESCE(NULLIF(m.province,''),cu.province,''),'postal_code',COALESCE(cu.postal_code,''),'latitude',cu.latitude,'longitude',cu.longitude,'maps_url',COALESCE(cu.maps_url,''),'place_id',COALESCE(cu.place_id,''));
  PERFORM pg_advisory_xact_lock(hashtextextended(COALESCE(sn,cname||'|'||addr)||'|'||v.visit_date::text,0));
  SELECT * INTO v FROM public.service_contract_visits WHERE id=v.id FOR UPDATE;
  aid := NULL; wid := NULL;
  SELECT * INTO a FROM public.appointments WHERE id=v.appointment_id;
  SELECT * INTO w FROM public.work_orders WHERE id=COALESCE(v.work_order_id,a.work_order_id);
  IF a.status IN ('closed','done','cancelled') OR w.status IN ('closed','done','rejected','cancelled') THEN CONTINUE; END IF;
  wid := w.id;
  IF wid IS NULL THEN
   SELECT * INTO w FROM public.work_orders wo WHERE wo.visit_date=v.visit_date AND wo.status IN ('pending','approved','scheduled','unscheduled','in_progress')
     AND ((sn IS NOT NULL AND trim(wo.serial_number)=sn) OR (sn IS NULL AND wo.customer_name=cname AND COALESCE(wo.customer_address,'')=addr))
     ORDER BY wo.created_at,wo.id LIMIT 1 FOR UPDATE;
   wid := w.id;
  END IF;
  IF wid IS NOT NULL THEN
   SELECT * INTO a FROM public.appointments WHERE work_order_id=wid AND status NOT IN ('closed','done','cancelled') ORDER BY created_at,id LIMIT 1 FOR UPDATE;
   aid := a.id;
  END IF;
  IF aid IS NULL THEN
   SELECT * INTO a FROM public.appointments ap WHERE (ap.id=v.appointment_id OR
     (ap.visit_date=v.visit_date AND ((sn IS NOT NULL AND trim(ap.serial_number)=sn) OR (sn IS NULL AND ap.customer_name=cname AND COALESCE(ap.customer_address,'')=addr))))
     AND ap.status IN ('pending','approved','scheduled','unscheduled','in_progress')
     ORDER BY (ap.id=v.appointment_id) DESC,ap.created_at,ap.id LIMIT 1 FOR UPDATE;
   aid := a.id;
   IF wid IS NULL AND a.work_order_id IS NOT NULL THEN
    SELECT * INTO w FROM public.work_orders WHERE id=a.work_order_id;
    IF w.status IN ('closed','done','rejected','cancelled') THEN CONTINUE; END IF;
    wid := w.id;
   END IF;
  END IF;
  target := CASE WHEN COALESCE(a.status,w.status)='in_progress' THEN 'in_progress' WHEN v.status='scheduled' OR a.status='scheduled' OR w.status='scheduled' THEN 'scheduled' ELSE 'approved' END;
  jobnumber := COALESCE(w.job_no,a.job_no,'JO-'||to_char(v.visit_date,'YYMMDD')||'-'||replace(v.id::text,'-',''));
  IF wid IS NULL THEN
   INSERT INTO public.work_orders(customer_name,customer_address,customer_location,contact_phone,cust_id,machine_label,serial_number,customer_sn,sales_rep,job_no,job_detail,service_type,billing_type,visit_date,visit_time,vehicle_plate,status,cross_zone_approval)
   VALUES(cname,addr,loc,cu.phone,cu.cust_id,label,sn,m.customer_sn,seller_name,jobnumber,COALESCE(v.job_detail,'บริการตามสัญญารายปี ครั้งที่ '||v.visit_no),'เช็กระยะตามสัญญา','ในสัญญาบริการ',v.visit_date,v.visit_time,v.vehicle_plate,target,a.cross_zone_approval) RETURNING id INTO wid;
   created_count := created_count+1;
  ELSE
   UPDATE public.work_orders SET status=target,job_no=jobnumber,customer_name=cname,customer_address=addr,customer_location=loc,contact_phone=COALESCE(cu.phone,contact_phone),cust_id=COALESCE(cu.cust_id,cust_id),machine_label=COALESCE(label,machine_label),serial_number=sn,customer_sn=COALESCE(m.customer_sn,customer_sn),sales_rep=COALESCE(seller_name,sales_rep),visit_date=v.visit_date,visit_time=COALESCE(v.visit_time,visit_time),vehicle_plate=COALESCE(v.vehicle_plate,vehicle_plate) WHERE id=wid;
   linked_count := linked_count+1;
  END IF;
  IF aid IS NULL THEN
   INSERT INTO public.appointments(work_order_id,machine_unit_id,customer_name,customer_address,customer_location,contact_phone,cust_id,machine_label,serial_number,customer_sn,sales_rep,job_no,job_detail,parts_note,service_type,billing_type,visit_date,visit_time,vehicle_plate,status)
   VALUES(wid,m.id,cname,addr,loc,cu.phone,cu.cust_id,label,sn,m.customer_sn,seller_name,jobnumber,COALESCE(v.job_detail,'บริการตามสัญญารายปี ครั้งที่ '||v.visit_no),v.parts_note,'เช็กระยะตามสัญญา','ในสัญญาบริการ',v.visit_date,v.visit_time,v.vehicle_plate,target) RETURNING id INTO aid;
  ELSE
   UPDATE public.appointments SET work_order_id=wid,machine_unit_id=COALESCE(m.id,machine_unit_id),status=target,job_no=jobnumber,customer_name=cname,customer_address=addr,customer_location=loc,contact_phone=COALESCE(cu.phone,contact_phone),cust_id=COALESCE(cu.cust_id,cust_id),machine_label=COALESCE(label,machine_label),serial_number=sn,customer_sn=COALESCE(m.customer_sn,customer_sn),sales_rep=COALESCE(seller_name,sales_rep),visit_date=v.visit_date,visit_time=COALESCE(v.visit_time,visit_time),vehicle_plate=COALESCE(v.vehicle_plate,vehicle_plate),job_detail=COALESCE(v.job_detail,job_detail),parts_note=COALESCE(v.parts_note,parts_note) WHERE id=aid;
  END IF;
  UPDATE public.service_contract_visits SET appointment_id=aid,work_order_id=wid WHERE id=v.id;
 END LOOP;
 RETURN jsonb_build_object('created',created_count,'linked',linked_count);
END $$;
REVOKE ALL ON FUNCTION public.sync_contract_jobs(uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sync_contract_jobs(uuid,boolean) TO service_role;