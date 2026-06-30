CREATE TABLE public.brands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    logo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.compressor_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(brand_id, name)
);

CREATE TABLE public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    part_number TEXT NOT NULL UNIQUE,
    description TEXT,
    price NUMERIC(12,2),
    stock_quantity INTEGER DEFAULT 0,
    brand_id UUID REFERENCES public.brands(id),
    model_id UUID REFERENCES public.compressor_models(id),
    category_id UUID REFERENCES public.categories(id),
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_products_brand ON public.products(brand_id);
CREATE INDEX idx_products_model ON public.products(model_id);
CREATE INDEX idx_products_category ON public.products(category_id);
CREATE INDEX idx_products_part_number ON public.products(part_number);

GRANT SELECT ON public.brands TO anon;
GRANT SELECT ON public.brands TO authenticated;
GRANT ALL ON public.brands TO service_role;

GRANT SELECT ON public.compressor_models TO anon;
GRANT SELECT ON public.compressor_models TO authenticated;
GRANT ALL ON public.compressor_models TO service_role;

GRANT SELECT ON public.categories TO anon;
GRANT SELECT ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;

GRANT SELECT ON public.products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;

ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compressor_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read brands" ON public.brands FOR SELECT TO anon USING (true);
CREATE POLICY "Allow public read compressor_models" ON public.compressor_models FOR SELECT TO anon USING (true);
CREATE POLICY "Allow public read categories" ON public.categories FOR SELECT TO anon USING (true);
CREATE POLICY "Allow public read products" ON public.products FOR SELECT TO anon USING (true);

CREATE POLICY "Allow authenticated full access brands" ON public.brands FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access compressor_models" ON public.compressor_models FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access categories" ON public.categories FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access products" ON public.products FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();