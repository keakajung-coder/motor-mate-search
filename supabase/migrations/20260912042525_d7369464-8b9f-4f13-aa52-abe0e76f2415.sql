DROP POLICY IF EXISTS "product_images_insert" ON storage.objects;

CREATE POLICY "product_images_insert"
  ON storage.objects
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] = 'products'
    AND lower(storage.extension(name)) IN ('jpg', 'jpeg', 'png', 'webp')
    AND name ~ '^products/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
  );