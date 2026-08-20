CREATE TYPE public.app_role AS ENUM ('admin', 'cashier');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile" ON public.profiles FOR ALL TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  barcode TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  brand TEXT NOT NULL DEFAULT 'Not available',
  category TEXT NOT NULL DEFAULT 'Uncategorised',
  subcategory TEXT NOT NULL DEFAULT 'Not available',
  mrp NUMERIC(12,2) NOT NULL DEFAULT 0,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  stock NUMERIC(12,3) NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'pcs',
  tax NUMERIC(5,2) NOT NULL DEFAULT 0,
  hsn TEXT NOT NULL DEFAULT 'Not available',
  image TEXT,
  low_stock_at NUMERIC(12,3) NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX products_user_barcode_idx ON public.products (user_id, barcode);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own products" ON public.products FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_no TEXT NOT NULL,
  mrp_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount NUMERIC(12,2) NOT NULL DEFAULT 0,
  savings NUMERIC(12,2) NOT NULL DEFAULT 0,
  taxable NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax NUMERIC(12,2) NOT NULL DEFAULT 0,
  cgst NUMERIC(12,2) NOT NULL DEFAULT 0,
  sgst NUMERIC(12,2) NOT NULL DEFAULT 0,
  igst NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_mode TEXT NOT NULL DEFAULT 'intra',
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_mode TEXT NOT NULL DEFAULT 'Cash',
  customer TEXT,
  session_id TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_sec INTEGER,
  demo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX sales_user_created_idx ON public.sales (user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales TO authenticated;
GRANT ALL ON public.sales TO service_role;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sales" ON public.sales FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  barcode TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  brand TEXT,
  mrp NUMERIC(12,2) NOT NULL DEFAULT 0,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax NUMERIC(5,2) NOT NULL DEFAULT 0,
  unit TEXT,
  qty NUMERIC(12,3) NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX sale_items_sale_idx ON public.sale_items (sale_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sale_items TO authenticated;
GRANT ALL ON public.sale_items TO service_role;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sale items" ON public.sale_items FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  delta NUMERIC(12,3) NOT NULL,
  reason TEXT NOT NULL DEFAULT 'adjustment',
  sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX stock_movements_user_idx ON public.stock_movements (user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own stock movements" ON public.stock_movements FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.store_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  store_name TEXT NOT NULL DEFAULT 'SmartCart Supermarket',
  address TEXT NOT NULL DEFAULT 'Not available',
  gstin TEXT NOT NULL DEFAULT 'Not available',
  currency TEXT NOT NULL DEFAULT 'INR',
  rate NUMERIC(12,6) NOT NULL DEFAULT 1,
  rate_source TEXT NOT NULL DEFAULT 'Manual entry',
  tax_mode TEXT NOT NULL DEFAULT 'intra',
  gst_slabs NUMERIC(5,2)[] NOT NULL DEFAULT ARRAY[0,5,12,18,28]::NUMERIC(5,2)[],
  role TEXT NOT NULL DEFAULT 'cashier',
  admin_pin_hash TEXT NOT NULL DEFAULT '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4',
  queue JSONB NOT NULL DEFAULT '{"lambda":12,"mu":5,"counters":2}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_settings TO authenticated;
GRANT ALL ON public.store_settings TO service_role;
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own settings" ON public.store_settings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER products_touch BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER store_settings_touch BEFORE UPDATE ON public.store_settings
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- New account bootstrap: profile, role, settings and the six starter products.
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''))
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'cashier')
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.store_settings (user_id) VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.products
    (user_id, barcode, name, category, subcategory, mrp, price, cost, stock, unit, tax, low_stock_at)
  VALUES
    (NEW.id, '8901030865278', 'Toor Dal 1kg', 'Grocery', 'Pulses', 160, 145, 120, 42, 'pkt', 5, 10),
    (NEW.id, '8901058000108', 'Instant Noodles 70g', 'Snacks', 'Instant food', 15, 14, 11, 8, 'pkt', 12, 20),
    (NEW.id, '8901725100018', 'Toned Milk 500ml', 'Dairy', 'Milk', 28, 27, 24, 60, 'pouch', 0, 15),
    (NEW.id, '8904004400021', 'Sunflower Oil 1L', 'Grocery', 'Edible oil', 145, 132, 118, 25, 'btl', 5, 8),
    (NEW.id, '8901063014008', 'Butter Biscuits 200g', 'Snacks', 'Biscuits', 35, 30, 24, 4, 'pkt', 18, 12),
    (NEW.id, '8901396212003', 'Toothpaste 100g', 'Personal Care', 'Oral care', 60, 55, 45, 30, 'pcs', 18, 10);

  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Atomic checkout: bill + lines + stock decrement + audit trail.
CREATE OR REPLACE FUNCTION public.checkout_sale(p_sale JSONB, p_items JSONB)
RETURNS public.sales
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user UUID := auth.uid();
  v_sale public.sales;
  v_item JSONB;
  v_product_id UUID;
  v_qty NUMERIC;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  INSERT INTO public.sales (
    user_id, invoice_no, mrp_total, subtotal, discount, savings, taxable, tax,
    cgst, sgst, igst, tax_mode, total, payment_mode, customer, session_id,
    started_at, completed_at, duration_sec, demo
  ) VALUES (
    v_user,
    COALESCE(p_sale->>'invoice_no', 'INV'),
    COALESCE((p_sale->>'mrp_total')::NUMERIC, 0),
    COALESCE((p_sale->>'subtotal')::NUMERIC, 0),
    COALESCE((p_sale->>'discount')::NUMERIC, 0),
    COALESCE((p_sale->>'savings')::NUMERIC, 0),
    COALESCE((p_sale->>'taxable')::NUMERIC, 0),
    COALESCE((p_sale->>'tax')::NUMERIC, 0),
    COALESCE((p_sale->>'cgst')::NUMERIC, 0),
    COALESCE((p_sale->>'sgst')::NUMERIC, 0),
    COALESCE((p_sale->>'igst')::NUMERIC, 0),
    COALESCE(p_sale->>'tax_mode', 'intra'),
    COALESCE((p_sale->>'total')::NUMERIC, 0),
    COALESCE(p_sale->>'payment_mode', 'Cash'),
    NULLIF(p_sale->>'customer', ''),
    NULLIF(p_sale->>'session_id', ''),
    COALESCE((p_sale->>'started_at')::TIMESTAMPTZ, now()),
    COALESCE((p_sale->>'completed_at')::TIMESTAMPTZ, now()),
    COALESCE((p_sale->>'duration_sec')::INTEGER, 0),
    COALESCE((p_sale->>'demo')::BOOLEAN, false)
  ) RETURNING * INTO v_sale;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb))
  LOOP
    v_qty := COALESCE((v_item->>'qty')::NUMERIC, 0);
    v_product_id := NULL;
    IF COALESCE(v_item->>'product_id', '') <> '' THEN
      SELECT id INTO v_product_id FROM public.products
      WHERE id = (v_item->>'product_id')::UUID AND user_id = v_user;
    END IF;

    INSERT INTO public.sale_items
      (sale_id, user_id, product_id, barcode, name, brand, mrp, price, tax, unit, qty)
    VALUES (
      v_sale.id, v_user, v_product_id,
      COALESCE(v_item->>'barcode', ''),
      COALESCE(v_item->>'name', 'Item'),
      v_item->>'brand',
      COALESCE((v_item->>'mrp')::NUMERIC, 0),
      COALESCE((v_item->>'price')::NUMERIC, 0),
      COALESCE((v_item->>'tax')::NUMERIC, 0),
      v_item->>'unit',
      v_qty
    );

    IF v_product_id IS NOT NULL AND v_qty > 0 THEN
      UPDATE public.products SET stock = GREATEST(0, stock - v_qty)
      WHERE id = v_product_id AND user_id = v_user;

      INSERT INTO public.stock_movements (user_id, product_id, delta, reason, sale_id)
      VALUES (v_user, v_product_id, -v_qty, 'sale', v_sale.id);
    END IF;
  END LOOP;

  RETURN v_sale;
END; $$;

REVOKE ALL ON FUNCTION public.checkout_sale(JSONB, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.checkout_sale(JSONB, JSONB) TO authenticated;

-- Manual stock adjustment with audit trail.
CREATE OR REPLACE FUNCTION public.adjust_stock(p_product_id UUID, p_delta NUMERIC, p_reason TEXT DEFAULT 'adjustment', p_note TEXT DEFAULT NULL)
RETURNS NUMERIC
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user UUID := auth.uid();
  v_stock NUMERIC;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  UPDATE public.products SET stock = GREATEST(0, stock + p_delta)
  WHERE id = p_product_id AND user_id = v_user
  RETURNING stock INTO v_stock;
  IF v_stock IS NULL THEN RAISE EXCEPTION 'Product not found'; END IF;
  INSERT INTO public.stock_movements (user_id, product_id, delta, reason, note)
  VALUES (v_user, p_product_id, p_delta, COALESCE(p_reason, 'adjustment'), p_note);
  RETURN v_stock;
END; $$;

REVOKE ALL ON FUNCTION public.adjust_stock(UUID, NUMERIC, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.adjust_stock(UUID, NUMERIC, TEXT, TEXT) TO authenticated;