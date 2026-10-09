-- GymTracker: schema + RLS
-- Da eseguire una volta nell'SQL editor di Supabase.

-- Programmi (mesocicli): il template completo sta in data (jsonb)
create table if not exists public.programs (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null,
  data        jsonb not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

-- Sedute
create table if not exists public.sessions (
  id            uuid primary key,
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  program_id    uuid,
  template_key  text not null,
  template_name text not null,
  started_at    timestamptz not null,
  ended_at      timestamptz,
  note          text,
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

-- Serie. Bilaterale: reps. Unilaterale: reps_d (destro) e reps_s (sinistro).
-- rir: 0 = cedimento, 1 = 1 RIR, 2 = 2+ RIR
create table if not exists public.sets (
  id            uuid primary key,
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  session_id    uuid not null references public.sessions(id) on delete cascade,
  exercise_key  text not null,
  exercise_name text not null,
  set_index     smallint not null,
  kg            numeric(6,2),
  reps          smallint,
  reps_d        smallint,
  reps_s        smallint,
  rir           smallint,
  done_at       timestamptz not null,
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

-- Note persistenti per esercizio
create table if not exists public.exercise_notes (
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  exercise_key  text not null,
  note          text not null default '',
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  primary key (user_id, exercise_key)
);

create index if not exists sets_session_idx      on public.sets (session_id);
create index if not exists sets_user_upd_idx     on public.sets (user_id, updated_at);
create index if not exists sessions_user_upd_idx on public.sessions (user_id, updated_at);
create index if not exists programs_user_upd_idx on public.programs (user_id, updated_at);
create index if not exists notes_user_upd_idx    on public.exercise_notes (user_id, updated_at);

-- RLS: ogni utente vede e scrive solo le proprie righe
alter table public.programs       enable row level security;
alter table public.sessions       enable row level security;
alter table public.sets           enable row level security;
alter table public.exercise_notes enable row level security;

drop policy if exists own_rows on public.programs;
drop policy if exists own_rows on public.sessions;
drop policy if exists own_rows on public.sets;
drop policy if exists own_rows on public.exercise_notes;

create policy own_rows on public.programs       for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy own_rows on public.sessions       for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy own_rows on public.sets           for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy own_rows on public.exercise_notes for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Privilegi espliciti: solo authenticated, niente ad anon
revoke all on public.programs, public.sessions, public.sets, public.exercise_notes from anon;
grant select, insert, update, delete
  on public.programs, public.sessions, public.sets, public.exercise_notes
  to authenticated;
