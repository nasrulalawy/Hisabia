-- Bucket untuk gambar produk: product_images, publik, max 2MB, hanya image
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
SELECT gen_random_uuid(), 'product_images', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE name = 'product_images');

-- Policy: siapa saja bisa baca (bucket publik)
CREATE POLICY "product_images_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'product_images');

-- Policy: hanya member organisasi yang bisa upload/update (path = org_id/product_id/...)
CREATE POLICY "product_images_org_upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'product_images'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] IN (
    SELECT o.organization_id::text
    FROM public.organization_members o
    WHERE o.user_id = auth.uid()
  )
);

CREATE POLICY "product_images_org_update"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'product_images'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] IN (
    SELECT o.organization_id::text
    FROM public.organization_members o
    WHERE o.user_id = auth.uid()
  )
);

CREATE POLICY "product_images_org_delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'product_images'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] IN (
    SELECT o.organization_id::text
    FROM public.organization_members o
    WHERE o.user_id = auth.uid()
  )
);
