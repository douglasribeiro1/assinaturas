-- Assinaturas: schema inicial. Cobranças futuras NÃO são gravadas; o cliente
-- calcula as ocorrências a partir de anchor_date + ciclo.

create table public.subscriptions (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name               text not null check (length(btrim(name)) > 0),
  amount_cents       integer not null check (amount_cents >= 0),
  currency           text not null default 'BRL' check (currency ~ '^[A-Z]{3}$'),
  cycle              text not null check (cycle in ('weekly', 'monthly', 'quarterly', 'yearly')),
  cycle_interval     integer not null default 1 check (cycle_interval >= 1),
  anchor_date        date not null,
  billing_day        smallint check (billing_day between 1 and 31),
  status             text not null default 'active' check (status in ('active', 'paused', 'cancelled')),
  ends_on            date check (ends_on is null or ends_on >= anchor_date),
  category           text,
  notes              text,
  remind_days_before smallint not null default 1 check (remind_days_before between 0 and 30),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz
);

create index subscriptions_user_updated_idx on public.subscriptions (user_id, updated_at);

-- Pago / valor ajustado de uma cobrança específica (opcional no MVP).
create table public.payment_overrides (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subscription_id uuid not null references public.subscriptions (id) on delete cascade,
  occurrence_date date not null,
  paid_at         timestamptz,
  amount_cents    integer check (amount_cents is null or amount_cents >= 0),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  unique (subscription_id, occurrence_date)
);

create index payment_overrides_user_updated_idx on public.payment_overrides (user_id, updated_at);

create table public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

-- Mantém updated_at confiável para o sync incremental (updated_at > último_sync).
-- Last-write-wins: o servidor carimba o horário da escrita.
create function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger subscriptions_touch before update on public.subscriptions
  for each row execute function public.touch_updated_at();
create trigger payment_overrides_touch before update on public.payment_overrides
  for each row execute function public.touch_updated_at();

-- RLS: cada usuário só enxerga e altera as próprias linhas.
alter table public.subscriptions     enable row level security;
alter table public.payment_overrides enable row level security;
alter table public.push_subscriptions enable row level security;

create policy subscriptions_owner on public.subscriptions
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- with check também garante que a assinatura referenciada pertence ao usuário.
create policy payment_overrides_owner on public.payment_overrides
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.subscriptions s
      where s.id = subscription_id and s.user_id = (select auth.uid())
    )
  );

create policy push_subscriptions_owner on public.push_subscriptions
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
