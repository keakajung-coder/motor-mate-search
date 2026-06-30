
CREATE POLICY "anon all customers" ON public.customers FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon all machine_units" ON public.machine_units FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon all machine_parts" ON public.machine_parts FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon all brands" ON public.brands FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon all categories" ON public.categories FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon all compressor_models" ON public.compressor_models FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon all products" ON public.products FOR ALL TO anon USING (true) WITH CHECK (true);
