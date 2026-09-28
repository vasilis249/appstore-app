
-- Enums
CREATE TYPE public.sport AS ENUM ('padel','tennis','basketball','football');
CREATE TYPE public.booking_type AS ENUM ('online','phone','closed');
CREATE TYPE public.booking_status AS ENUM ('pending','confirmed','cancelled','completed');
CREATE TYPE public.app_role AS ENUM ('admin','owner','coach','player');
CREATE TYPE public.player_level AS ENUM ('beginner','intermediate','advanced');

-- updated_at helper
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  photo_url TEXT,
  level public.player_level DEFAULT 'beginner',
  games_played INT NOT NULL DEFAULT 0,
  rating NUMERIC(3,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- user_roles (separate table for security)
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
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- venues
CREATE TABLE public.venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sport public.sport NOT NULL,
  area TEXT NOT NULL,
  address TEXT,
  lat NUMERIC(9,6),
  lng NUMERIC(9,6),
  base_price_per_hour NUMERIC(8,2) NOT NULL DEFAULT 0,
  rating NUMERIC(3,2) DEFAULT 0,
  reviews_count INT NOT NULL DEFAULT 0,
  courts_count INT NOT NULL DEFAULT 0,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  amenities TEXT[] NOT NULL DEFAULT '{}',
  photo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.venues TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.venues TO authenticated;
GRANT ALL ON public.venues TO service_role;
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Venues are viewable by everyone" ON public.venues FOR SELECT USING (true);
CREATE POLICY "Owners manage own venues" ON public.venues FOR ALL TO authenticated
  USING (auth.uid() = owner_id OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (auth.uid() = owner_id OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_venues_updated BEFORE UPDATE ON public.venues FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- courts
CREATE TABLE public.courts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sport public.sport NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.courts TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.courts TO authenticated;
GRANT ALL ON public.courts TO service_role;
ALTER TABLE public.courts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Courts are viewable by everyone" ON public.courts FOR SELECT USING (true);
CREATE POLICY "Venue owners manage courts" ON public.courts FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.venues v WHERE v.id = venue_id AND (v.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.venues v WHERE v.id = venue_id AND (v.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));

-- bookings
CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  court_id UUID NOT NULL REFERENCES public.courts(id) ON DELETE CASCADE,
  venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  player_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  duration_hours NUMERIC(3,1) NOT NULL DEFAULT 1,
  type public.booking_type NOT NULL DEFAULT 'online',
  status public.booking_status NOT NULL DEFAULT 'pending',
  payment_method TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  price NUMERIC(8,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookings TO authenticated;
GRANT ALL ON public.bookings TO service_role;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Players see own bookings" ON public.bookings FOR SELECT TO authenticated
  USING (auth.uid() = player_id
    OR EXISTS (SELECT 1 FROM public.venues v WHERE v.id = venue_id AND v.owner_id = auth.uid())
    OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Players create bookings" ON public.bookings FOR INSERT TO authenticated WITH CHECK (auth.uid() = player_id OR EXISTS (SELECT 1 FROM public.venues v WHERE v.id = venue_id AND v.owner_id = auth.uid()));
CREATE POLICY "Owners/players update bookings" ON public.bookings FOR UPDATE TO authenticated
  USING (auth.uid() = player_id OR EXISTS (SELECT 1 FROM public.venues v WHERE v.id = venue_id AND v.owner_id = auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Owners/players delete bookings" ON public.bookings FOR DELETE TO authenticated
  USING (auth.uid() = player_id OR EXISTS (SELECT 1 FROM public.venues v WHERE v.id = venue_id AND v.owner_id = auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_bookings_updated BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- open_games
CREATE TABLE public.open_games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  sport public.sport NOT NULL,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  level public.player_level,
  max_players INT NOT NULL DEFAULT 4,
  host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.open_games TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.open_games TO authenticated;
GRANT ALL ON public.open_games TO service_role;
ALTER TABLE public.open_games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Open games viewable" ON public.open_games FOR SELECT USING (true);
CREATE POLICY "Host manages open game" ON public.open_games FOR ALL TO authenticated
  USING (auth.uid() = host_id OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (auth.uid() = host_id);

-- open_game_players
CREATE TABLE public.open_game_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  open_game_id UUID NOT NULL REFERENCES public.open_games(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (open_game_id, player_id)
);
GRANT SELECT ON public.open_game_players TO anon, authenticated;
GRANT INSERT, DELETE ON public.open_game_players TO authenticated;
GRANT ALL ON public.open_game_players TO service_role;
ALTER TABLE public.open_game_players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Players viewable" ON public.open_game_players FOR SELECT USING (true);
CREATE POLICY "Player joins self" ON public.open_game_players FOR INSERT TO authenticated WITH CHECK (auth.uid() = player_id);
CREATE POLICY "Player leaves self" ON public.open_game_players FOR DELETE TO authenticated USING (auth.uid() = player_id);

-- reviews
CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_player_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.reviews TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reviews viewable" ON public.reviews FOR SELECT USING (true);
CREATE POLICY "Reviewer creates" ON public.reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = reviewer_id);
CREATE POLICY "Reviewer updates" ON public.reviews FOR UPDATE TO authenticated USING (auth.uid() = reviewer_id);
CREATE POLICY "Reviewer deletes" ON public.reviews FOR DELETE TO authenticated USING (auth.uid() = reviewer_id);

-- auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'player');
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
