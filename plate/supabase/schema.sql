-- Plate database schema. Run once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.

-- ---------- profiles (1:1 with auth.users) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  sex text check (sex in ('male', 'female')),
  age integer check (age between 13 and 100),
  height_cm numeric check (height_cm between 120 and 230),
  weight_kg numeric check (weight_kg between 30 and 300),
  activity_level text check (activity_level in ('sedentary', 'light', 'moderate', 'active', 'athlete')),
  goal text check (goal in ('lose_fat', 'get_lean', 'maintain', 'build_muscle')),
  calorie_goal integer check (calorie_goal >= 1200),
  protein_goal integer,
  carbs_goal integer,
  fat_goal integer,
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- meals ----------
create table if not exists public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  description text,
  portion text,
  image_path text,
  meal_slot text not null check (meal_slot in ('breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner')),
  eaten_on date not null,
  eaten_at timestamptz not null default now(),
  calories numeric not null default 0,
  protein_g numeric not null default 0,
  carbs_g numeric not null default 0,
  fat_g numeric not null default 0,
  fiber_g numeric not null default 0,
  sugar_g numeric not null default 0,
  sodium_mg numeric not null default 0,
  ingredients jsonb not null default '[]'::jsonb,
  micros jsonb not null default '[]'::jsonb,
  confidence text check (confidence in ('low', 'medium', 'high')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists meals_user_day_idx on public.meals (user_id, eaten_on);

-- ---------- updated_at trigger ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists meals_updated_at on public.meals;
create trigger meals_updated_at before update on public.meals
  for each row execute function public.set_updated_at();

-- ---------- auto-create a profile row for every new user ----------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- row level security: users only ever see their own rows ----------
alter table public.profiles enable row level security;
alter table public.meals enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "own meals" on public.meals;
create policy "own meals" on public.meals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- private storage bucket for meal photos ----------
-- Files live at meal-photos/<user_id>/<file>, and each user can only touch their own folder.
insert into storage.buckets (id, name, public)
values ('meal-photos', 'meal-photos', false)
on conflict (id) do nothing;

drop policy if exists "own meal photos" on storage.objects;
create policy "own meal photos" on storage.objects
  for all to authenticated
  using (bucket_id = 'meal-photos' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'meal-photos' and auth.uid()::text = (storage.foldername(name))[1]);
