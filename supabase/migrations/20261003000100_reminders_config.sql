-- Config privada (chaves VAPID + segredo do cron). RLS ligada sem policies e
-- sem grants para anon/authenticated: só service_role (edge function) e
-- postgres (pg_cron) leem.
create table public.app_config (key text primary key, value text not null);
alter table public.app_config enable row level security;
revoke all on public.app_config from anon, authenticated;
