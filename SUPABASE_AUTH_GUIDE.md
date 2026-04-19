# Supabase Auth Integration Guide (Login + Sign Up)

This project now includes:

- `pages/signup.js` for account registration
- `pages/login.js` for account login
- `styles/auth.module.css` for theme-aligned auth styling

Both pages already use `supabase.auth.signUp()` and `supabase.auth.signInWithPassword()`.

## 1) Configure Environment Variables

Your `lib/supabaseClient.js` expects these variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Place them in `.env.local`, then restart the dev server.

## 2) Enable Email/Password Auth in Supabase

In your Supabase dashboard:

1. Go to **Authentication > Providers**
2. Enable **Email**
3. Keep **Confirm email** ON (recommended for production)

If email confirmation is enabled, users must verify first before they can fully sign in.

## 3) Test the Pages

Run:

```bash
npm run dev
```

Then open:

- `http://localhost:3000/signup`
- `http://localhost:3000/login`

### Sign-up flow

- User enters full name, email, and password
- `signup.js` calls:
  - `supabase.auth.signUp({ email, password, options: { data: { full_name } } })`
- Supabase creates a user in `auth.users`
- `full_name` is stored in user metadata

### Login flow

- User enters email and password
- `login.js` calls:
  - `supabase.auth.signInWithPassword({ email, password })`
- On success, page redirects to `/`

## 4) (Optional) Create a `profiles` Table

If you want app-specific user data (avatar, preferences, etc.), create a `profiles` table and connect it to the auth user id.

```sql
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can view their own profile"
on public.profiles
for select
using (auth.uid() = id);

create policy "Users can insert their own profile"
on public.profiles
for insert
with check (auth.uid() = id);

create policy "Users can update their own profile"
on public.profiles
for update
using (auth.uid() = id);
```

## 5) Auto-create Profile Rows (Recommended)

Run this SQL in Supabase SQL Editor:

```sql
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

Now every successful signup automatically creates a profile record.

## 6) Read Current Logged-in User

Use this in any page/component:

```js
const { data, error } = await supabase.auth.getUser()
const user = data?.user
```

## 7) Add Logout Button

Use this action for sign out:

```js
await supabase.auth.signOut()
```

Then redirect the user to `/login` or landing page.

## 8) Protect Pages (Optional Next Step)

To require authentication for pages like `/plan`, check session on load:

```js
const { data } = await supabase.auth.getSession()
if (!data.session) router.push('/login')
```

For stronger protection, add middleware later to block unauthenticated routes.

create table if not exists public.events (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  location text not null,
  price text,
  date date not null,
  category text not null,
  created_at timestamptz default now()
);

alter table public.events enable row level security;

-- Policies to allow authenticated users to perform CRUD on their own events:
create policy "Users can view their own events" on public.events for select using (auth.uid() = user_id);
create policy "Users can insert their own events" on public.events for insert with check (auth.uid() = user_id);
create policy "Users can update their own events" on public.events for update using (auth.uid() = user_id);
create policy "Users can delete their own events" on public.events for delete using (auth.uid() = user_id);
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

-- ============================================================================
-- VERIFICATION QUERIES (Run these to check tables were created)
-- ============================================================================
-- SELECT * FROM public.profiles LIMIT 1;
-- SELECT * FROM public.saved_locations LIMIT 1;
-- SELECT * FROM public.saved_itineraries LIMIT 1;
-- SELECT * FROM public.user_analytics LIMIT 1;

-- ============================================================================
-- ITINERARY FEATURE: SCHEMA UPDATES
-- Run this in Supabase SQL Editor (Database > SQL Editor > New Query)
-- ============================================================================

-- 1. ALTER EVENTS TABLE — Add venue, datetime, and coordinate fields
-- ============================================================================
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS venue TEXT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS start_datetime TIMESTAMPTZ;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS end_datetime TIMESTAMPTZ;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS latitude NUMERIC;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS longitude NUMERIC;

-- 2. CREATE ITINERARY_ACTIVITIES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.itinerary_activities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_name TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  location TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.itinerary_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own activities"
  ON public.itinerary_activities FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own activities"
  ON public.itinerary_activities FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own activities"
  ON public.itinerary_activities FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own activities"
  ON public.itinerary_activities FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'events';
-- SELECT * FROM public.itinerary_activities LIMIT 1;
