DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['app_settings','appointments','brands','categories','compressor_models','customers','machine_parts','machine_units','maintenance_logs','part_bundle_items','part_bundles','products','service_staff','vehicles','work_orders'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'anon all ' || t, t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO anon USING (true)', 'anon read ' || t, t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO anon WITH CHECK (true)', 'anon insert ' || t, t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO anon USING (true) WITH CHECK (true)', 'anon update ' || t, t);
  END LOOP;
END $$;

-- Storage: allow read + upload of product images, but no overwrite/delete without a policy
CREATE POLICY "product_images_read"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'product-images');

CREATE POLICY "product_images_insert"
  ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'product-images');