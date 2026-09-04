-- League chat (v2.5). Safe to run once or twice. Fresh installs get this from schema.sql.
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists messages_league_idx on public.messages (league_id, created_at desc);
alter table public.messages enable row level security;
drop policy if exists messages_read on public.messages;
drop policy if exists messages_insert on public.messages;
drop policy if exists messages_delete on public.messages;
create policy messages_read on public.messages for select to authenticated using (is_member(league_id));
create policy messages_insert on public.messages for insert to authenticated with check (user_id = auth.uid() and is_member(league_id));
create policy messages_delete on public.messages for delete to authenticated using (user_id = auth.uid() or is_commissioner(league_id));
