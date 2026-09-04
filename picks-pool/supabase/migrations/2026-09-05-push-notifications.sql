-- Push notifications (v2.2). For a database already on v2 or v2.1. Safe to
-- run once or twice; keeps everything. Fresh installs get this from schema.sql.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

create table if not exists public.push_sent (
  league_id uuid not null references public.leagues on delete cascade,
  season int not null,
  slate_key text not null,
  kind text not null,
  key text not null,
  value text not null default '',
  sent_at timestamptz not null default now(),
  primary key (league_id, season, slate_key, kind, key)
);

alter table public.push_subscriptions enable row level security;
alter table public.push_sent enable row level security;

drop policy if exists push_subscriptions_read on public.push_subscriptions;
drop policy if exists push_subscriptions_insert on public.push_subscriptions;
drop policy if exists push_subscriptions_update on public.push_subscriptions;
drop policy if exists push_subscriptions_delete on public.push_subscriptions;
create policy push_subscriptions_read on public.push_subscriptions for select to authenticated
  using (user_id = auth.uid());
create policy push_subscriptions_insert on public.push_subscriptions for insert to authenticated
  with check (user_id = auth.uid());
create policy push_subscriptions_update on public.push_subscriptions for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy push_subscriptions_delete on public.push_subscriptions for delete to authenticated
  using (user_id = auth.uid());
