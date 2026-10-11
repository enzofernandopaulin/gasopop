CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TYPE public.fuel_type AS ENUM ('gasolina_comum','gasolina_aditivada','etanol','diesel_s10','diesel_comum','gnv');
CREATE TYPE public.station_brand AS ENUM ('petrobras','shell','ipiranga','raizen','bandeira_branca','outra');
CREATE TYPE public.price_source AS ENUM ('user','anp');
CREATE TYPE public.user_plan AS ENUM ('free','premium');

-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  default_fuel_type public.fuel_type NOT NULL DEFAULT 'gasolina_comum',
  avg_consumption_kml numeric(5,2) NOT NULL DEFAULT 10.0,
  flex_fuel boolean NOT NULL DEFAULT true,
  points integer NOT NULL DEFAULT 0,
  plan public.user_plan NOT NULL DEFAULT 'free',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_delete_own" ON public.profiles FOR DELETE TO authenticated USING (auth.uid() = id);

-- STATIONS
CREATE TABLE public.stations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  brand public.station_brand NOT NULL DEFAULT 'bandeira_branca',
  address text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  geog geography(Point,4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(longitude, latitude),4326)::geography) STORED,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX stations_geog_idx ON public.stations USING GIST (geog);
GRANT SELECT ON public.stations TO anon;
GRANT SELECT ON public.stations TO authenticated;
GRANT ALL ON public.stations TO service_role;
ALTER TABLE public.stations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stations_public_read" ON public.stations FOR SELECT TO anon, authenticated USING (true);

-- PRICE REPORTS
CREATE TABLE public.price_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES public.stations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  fuel_type public.fuel_type NOT NULL,
  price numeric(6,3) NOT NULL CHECK (price > 0 AND price < 100),
  source public.price_source NOT NULL DEFAULT 'user',
  reported_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX price_reports_station_idx ON public.price_reports (station_id, fuel_type, reported_at DESC);
GRANT SELECT ON public.price_reports TO anon;
GRANT SELECT, INSERT ON public.price_reports TO authenticated;
GRANT ALL ON public.price_reports TO service_role;
ALTER TABLE public.price_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "price_reports_public_read" ON public.price_reports FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "price_reports_insert_own" ON public.price_reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND source = 'user');

-- CONFIRMATIONS
CREATE TABLE public.confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  price_report_id uuid NOT NULL REFERENCES public.price_reports(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (price_report_id, user_id)
);
GRANT SELECT ON public.confirmations TO anon;
GRANT SELECT, INSERT, DELETE ON public.confirmations TO authenticated;
GRANT ALL ON public.confirmations TO service_role;
ALTER TABLE public.confirmations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "confirmations_public_read" ON public.confirmations FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "confirmations_insert_own" ON public.confirmations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "confirmations_delete_own" ON public.confirmations FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- FAVORITES
CREATE TABLE public.favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  station_id uuid NOT NULL REFERENCES public.stations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, station_id)
);
GRANT SELECT, INSERT, DELETE ON public.favorites TO authenticated;
GRANT ALL ON public.favorites TO service_role;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "favorites_all_own" ON public.favorites FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- PROFILE AUTO-CREATION
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- POINTS
CREATE OR REPLACE FUNCTION public.award_points(_user_id uuid, _points integer)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.profiles SET points = points + _points, updated_at = now() WHERE id = _user_id;
$$;

CREATE OR REPLACE FUNCTION public.points_on_report()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    PERFORM public.award_points(NEW.user_id, 10);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER price_reports_points AFTER INSERT ON public.price_reports FOR EACH ROW EXECUTE FUNCTION public.points_on_report();

CREATE OR REPLACE FUNCTION public.points_on_confirmation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.award_points(NEW.user_id, 5);
  RETURN NEW;
END;
$$;
CREATE TRIGGER confirmations_points AFTER INSERT ON public.confirmations FOR EACH ROW EXECUTE FUNCTION public.points_on_confirmation();

-- NEARBY SEARCH (PostGIS)
CREATE OR REPLACE FUNCTION public.nearby_stations(_lat double precision, _lng double precision, _radius_km double precision DEFAULT 10)
RETURNS TABLE (
  id uuid,
  name text,
  brand public.station_brand,
  address text,
  city text,
  latitude double precision,
  longitude double precision,
  distance_km double precision
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT s.id, s.name, s.brand, s.address, s.city, s.latitude, s.longitude,
         ST_Distance(s.geog, ST_SetSRID(ST_MakePoint(_lng, _lat),4326)::geography) / 1000.0 AS distance_km
  FROM public.stations s
  WHERE ST_DWithin(s.geog, ST_SetSRID(ST_MakePoint(_lng, _lat),4326)::geography, _radius_km * 1000)
  ORDER BY distance_km ASC
  LIMIT 60;
$$;
GRANT EXECUTE ON FUNCTION public.nearby_stations(double precision, double precision, double precision) TO anon, authenticated, service_role;

-- SEED STATIONS
INSERT INTO public.stations (name, brand, address, city, latitude, longitude) VALUES
('Posto Ipiranga Paulista','ipiranga','Av. Paulista, 1200','São Paulo',-23.5629,-46.6544),
('Shell Select Consolação','shell','R. da Consolação, 2450','São Paulo',-23.5545,-46.6620),
('Petrobras BR Faria Lima','petrobras','Av. Brig. Faria Lima, 1500','São Paulo',-23.5760,-46.6890),
('Auto Posto Vergueiro','bandeira_branca','R. Vergueiro, 3100','São Paulo',-23.5880,-46.6390),
('Raízen Rebouças','raizen','Av. Rebouças, 900','São Paulo',-23.5670,-46.6790),
('Posto Ipiranga Pinheiros','ipiranga','R. dos Pinheiros, 780','São Paulo',-23.5650,-46.6910),
('Shell Ibirapuera','shell','Av. Ibirapuera, 2100','São Paulo',-23.6050,-46.6650),
('Auto Posto Berrini','bandeira_branca','Av. Eng. Luís Carlos Berrini, 500','São Paulo',-23.6110,-46.6960),
('Petrobras BR Tiradentes','petrobras','Av. Tiradentes, 400','São Paulo',-23.5290,-46.6340),
('Posto Popular Santana','bandeira_branca','Av. Cruzeiro do Sul, 1300','São Paulo',-23.5090,-46.6250),
('Raízen Marginal Pinheiros','raizen','Marginal Pinheiros, 8000','São Paulo',-23.5980,-46.7100),
('Shell Anhangabaú','shell','Vale do Anhangabaú, 100','São Paulo',-23.5460,-46.6380),
('Posto Ipiranga Tatuapé','ipiranga','R. Tuiuti, 1450','São Paulo',-23.5400,-46.5760),
('Auto Posto Lapa','bandeira_branca','R. Cel. Marques Ribeiro, 220','São Paulo',-23.5230,-46.7040);

-- SEED PRICES (community/ANP baseline)
INSERT INTO public.price_reports (station_id, user_id, fuel_type, price, source, reported_at)
SELECT s.id, NULL, f.ft::public.fuel_type,
       ROUND((f.base + (((('x' || substr(md5(s.name || f.ft), 1, 4))::bit(16)::int) % 28) / 100.0))::numeric, 2),
       'anp'::public.price_source,
       now() - ((((('x' || substr(md5(s.name || f.ft || 'h'), 1, 4))::bit(16)::int) % 40) + 1) || ' hours')::interval
FROM public.stations s
CROSS JOIN (VALUES
  ('gasolina_comum', 5.79),
  ('gasolina_aditivada', 5.99),
  ('etanol', 3.89),
  ('diesel_s10', 6.09)
) AS f(ft, base);