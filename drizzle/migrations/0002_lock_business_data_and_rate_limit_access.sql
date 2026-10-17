CREATE TABLE public.access_rate_limits (key text PRIMARY KEY, attempts integer NOT NULL DEFAULT 0, window_started timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.access_rate_limits TO service_role;
ALTER TABLE public.access_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.access_rate_limits FROM anon, authenticated;
CREATE OR REPLACE FUNCTION public.consume_access_limit(p_key text, p_limit integer, p_seconds integer) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
 IF p_limit < 1 OR p_seconds < 1 THEN RETURN false; END IF;
 INSERT INTO public.access_rate_limits AS r(key,attempts,window_started) VALUES(p_key,1,now()) ON CONFLICT(key) DO UPDATE SET attempts = CASE WHEN r.window_started < now() - make_interval(secs => p_seconds) THEN 1 ELSE r.attempts + 1 END, window_started = CASE WHEN r.window_started < now() - make_interval(secs => p_seconds) THEN now() ELSE r.window_started END RETURNING attempts INTO n;
 RETURN n <= p_limit;
END $$;
REVOKE ALL ON FUNCTION public.consume_access_limit(text,integer,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_access_limit(text,integer,integer) TO service_role;
DO $$ DECLARE r record; BEGIN
 FOR r IN SELECT tablename, policyname FROM pg_policies WHERE schemaname='public' LOOP
 EXECUTE format('DROP POLICY %I ON public.%I',r.policyname,r.tablename);
 END LOOP;
 FOR r IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',r.tablename);
 EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated',r.tablename);
 EXECUTE format('GRANT ALL ON public.%I TO service_role',r.tablename);
 END LOOP;
 FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND (qual LIKE '%job-attachments%' OR with_check LIKE '%job-attachments%' OR qual LIKE '%product-images%' OR with_check LIKE '%product-images%' OR qual LIKE '%excel-backups%' OR with_check LIKE '%excel-backups%') LOOP
 EXECUTE format('DROP POLICY %I ON storage.objects',r.policyname);
 END LOOP;
END $$;