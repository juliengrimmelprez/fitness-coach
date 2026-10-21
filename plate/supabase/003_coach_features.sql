-- Plate migration 003: weight tracker + cached AI outputs (weekly review, training plan).
-- Run once in Supabase: SQL Editor -> New query -> paste -> Run. Safe to re-run.

-- ---------- Weigh-ins (one per user per day) ----------
create table if not exists public.weight_logs (
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  weight_kg numeric not null check (weight_kg between 30 and 300),
  note text,
  created_at timestamptz not null default now(),
  primary key (user_id, date)
);

alter table public.weight_logs enable row level security;
drop policy if exists "own weights" on public.weight_logs;
create policy "own weights" on public.weight_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- Cached AI outputs: kind = 'weekly_review' | 'training_plan', key = a date ----------
create table if not exists public.ai_cache (
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  key text not null,
  content jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, kind, key)
);

alter table public.ai_cache enable row level security;
drop policy if exists "own ai cache" on public.ai_cache;
create policy "own ai cache" on public.ai_cache
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
