-- ============================================================================
-- SUPABASE SCHEMA UPDATES FOR ENHANCED PROFILE PAGE
-- Run this in Supabase SQL Editor (Database > SQL Editor > New Query)
-- ============================================================================

-- 1. ALTER PROFILES TABLE TO INCLUDE NEW FIELDS
-- ============================================================================
ALTER TABLE public.profiles ADD COLUMN budget_php NUMERIC DEFAULT 5000;
ALTER TABLE public.profiles ADD COLUMN environment TEXT DEFAULT 'Both';
ALTER TABLE public.profiles ADD COLUMN pace TEXT DEFAULT 'Relaxed';
ALTER TABLE public.profiles ADD COLUMN email_updates BOOLEAN DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();

-- 2. CREATE SAVED_LOCATIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.saved_locations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- e.g., 'Historical', 'Attraction', 'Restaurant', 'Beach'
  description TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, name) -- Prevent duplicate location names per user
);

ALTER TABLE public.saved_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own saved locations"
  ON public.saved_locations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own saved locations"
  ON public.saved_locations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own saved locations"
  ON public.saved_locations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own saved locations"
  ON public.saved_locations FOR DELETE
  USING (auth.uid() = user_id);

-- 3. CREATE SAVED_ITINERARIES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.saved_itineraries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  budget_php NUMERIC,
  status TEXT DEFAULT 'planned', -- 'planned', 'ongoing', 'completed'
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.saved_itineraries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own itineraries"
  ON public.saved_itineraries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own itineraries"
  ON public.saved_itineraries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own itineraries"
  ON public.saved_itineraries FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own itineraries"
  ON public.saved_itineraries FOR DELETE
  USING (auth.uid() = user_id);

-- 4. CREATE USER_ANALYTICS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  trips_taken INT DEFAULT 0,
  places_visited INT DEFAULT 0,
  most_visited_city TEXT,
  total_distance_km NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.user_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own analytics"
  ON public.user_analytics FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own analytics"
  ON public.user_analytics FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own analytics"
  ON public.user_analytics FOR UPDATE
  USING (auth.uid() = user_id);

-- 5. UPDATE EXISTING HANDLE_NEW_USER TRIGGER TO INCLUDE ANALYTICS & EXTENDED PROFILE
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Insert profile with extended fields
  INSERT INTO public.profiles (
    id,
    full_name,
    budget_php,
    environment,
    pace,
    email_updates,
    created_at
  )
  VALUES (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    5000, -- Default budget: 5000 PHP
    'Both', -- Default environment
    'Relaxed', -- Default pace
    true, -- Default email updates enabled
    now()
  )
  ON CONFLICT (id) DO NOTHING;

  -- Insert analytics with default zeros
  INSERT INTO public.user_analytics (
    user_id,
    trips_taken,
    places_visited,
    most_visited_city,
    created_at
  )
  VALUES (
    new.id,
    0,
    0,
    NULL,
    now()
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN new;
END;
$$;

-- Recreate trigger to ensure it runs with updated function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_new_user();

-- 6. ADD LATITUDE AND LONGITUDE TO ITINERARY_ACTIVITIES TABLE
-- ============================================================================
ALTER TABLE public.itinerary_activities ADD COLUMN IF NOT EXISTS latitude NUMERIC;
ALTER TABLE public.itinerary_activities ADD COLUMN IF NOT EXISTS longitude NUMERIC;

-- ============================================================================
-- VERIFICATION QUERIES (Run these to check tables were created)
-- ============================================================================
-- SELECT * FROM public.profiles LIMIT 1;
-- SELECT * FROM public.saved_locations LIMIT 1;
-- SELECT * FROM public.saved_itineraries LIMIT 1;
-- SELECT * FROM public.user_analytics LIMIT 1;
-- SELECT * FROM public.itinerary_activities LIMIT 1;
