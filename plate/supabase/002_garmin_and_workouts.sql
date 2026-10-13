-- Plate migration 002: Garmin data + manual workout logging.
-- Run once in Supabase: SQL Editor -> New query -> paste -> Run. Safe to re-run.

-- ---------- Garmin daily wellness (one row per user per day) ----------
-- Written only by the background sync (service key); users can read their own rows.
create table if not exists public.garmin_daily (
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  sleep_min integer,
  deep_sleep_min integer,
  light_sleep_min integer,
  rem_sleep_min integer,
  awake_min integer,
  sleep_score integer,
  hrv_last_night_ms numeric,
  hrv_weekly_avg_ms numeric,
  hrv_status text,
  resting_hr integer,
  avg_stress integer,
  body_battery_high integer,
  body_battery_low integer,
  body_battery_charged integer,
  body_battery_drained integer,
  steps integer,
  active_kcal numeric,
  total_kcal numeric,
  intensity_min_moderate integer,
  intensity_min_vigorous integer,
  vo2max numeric,
  synced_at timestamptz not null default now(),
  primary key (user_id, date)
);

-- ---------- Garmin activities (runs, gym sessions, soccer...) ----------
create table if not exists public.garmin_activities (
  id bigint primary key,                 -- Garmin's activityId
  user_id uuid not null references auth.users (id) on delete cascade,
  name text,
  type text,
  start_local timestamp,                 -- watch-local time, no timezone
  local_date date not null,
  duration_min numeric,
  distance_km numeric,
  pace_s_per_km integer,
  avg_hr integer,
  max_hr integer,
  calories numeric,
  aerobic_te numeric,
  anaerobic_te numeric,
  training_load numeric,
  elevation_gain_m numeric,
  strength_sets jsonb,                   -- Garmin's auto-detected sets (kept for past sessions)
  synced_at timestamptz not null default now()
);

create index if not exists garmin_activities_user_day_idx on public.garmin_activities (user_id, local_date);

alter table public.garmin_daily enable row level security;
alter table public.garmin_activities enable row level security;

drop policy if exists "read own garmin daily" on public.garmin_daily;
create policy "read own garmin daily" on public.garmin_daily for select using (auth.uid() = user_id);

drop policy if exists "read own garmin activities" on public.garmin_activities;
create policy "read own garmin activities" on public.garmin_activities for select using (auth.uid() = user_id);

-- ---------- Manually logged gym workouts ----------
-- exercises: [{ "id": "Barbell_Squat", "name": "Barbell Squat", "sets": [{ "weight_kg": 60, "reps": 8, "done": true }] }]
create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  name text not null default 'Workout',
  started_at timestamptz not null default now(),
  ended_at timestamptz,                  -- null while the workout is in progress
  notes text,
  exercises jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workouts_user_day_idx on public.workouts (user_id, date);

drop trigger if exists workouts_updated_at on public.workouts;
create trigger workouts_updated_at before update on public.workouts
  for each row execute function public.set_updated_at();

alter table public.workouts enable row level security;

drop policy if exists "own workouts" on public.workouts;
create policy "own workouts" on public.workouts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- Coach: one AI brief per day, cached so it isn't regenerated on every visit ----------
create table if not exists public.coach_briefs (
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  brief jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, date)
);

alter table public.coach_briefs enable row level security;

drop policy if exists "own briefs" on public.coach_briefs;
create policy "own briefs" on public.coach_briefs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- Training-adjusted calorie targets (on by default) ----------
alter table public.profiles add column if not exists training_adjusted boolean not null default true;
