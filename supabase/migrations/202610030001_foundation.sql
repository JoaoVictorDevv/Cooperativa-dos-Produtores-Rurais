begin;

create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;

create type public.member_role as enum ('ADMIN', 'OPERADOR', 'CONSULTA');
create type public.week_status as enum ('PLANEJAMENTO', 'ABERTO', 'FECHADO');
create type public.billing_method as enum ('LEGADO_PEDIDO_MENOS_DEVOLUCAO', 'ACEITE_ESCOLAR');
create type public.delivery_event_kind as enum ('INICIAL', 'COMPLEMENTO');
create type public.complement_trip as enum ('MESMA_VIAGEM', 'OUTRA_VIAGEM');
create type public.supply_source_type as enum ('PRODUTOR', 'SALDO_GALPAO');
create type public.shortage_decision_kind as enum ('EM_RESOLUCAO', 'ENCERRADA_SEM_ATENDIMENTO');
create type public.product_unit as enum ('kg', 'dz');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 180),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  document text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.member_role not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index organization_members_user_active_idx on public.organization_members(user_id) where active;

create table public.organization_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  default_logistics_deduction numeric(12,2) not null default 3.67 check (default_logistics_deduction >= 0),
  pnae_annual_limit numeric(14,2) not null default 40000 check (pnae_annual_limit > 0),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (length(trim(name)) between 2 and 140),
  unit public.product_unit not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug),
  unique (organization_id, id)
);

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  code text not null,
  name text not null check (length(trim(name)) between 2 and 180),
  neighborhood text,
  address text,
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code),
  unique (organization_id, id)
);

create table public.producers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  internal_id text not null,
  name text not null check (length(trim(name)) between 2 and 180),
  document text,
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, internal_id),
  unique (organization_id, id)
);

create table public.return_reasons (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  code integer not null check (code > 0),
  description text not null check (length(trim(description)) between 3 and 180),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code),
  unique (organization_id, id)
);

create table public.prices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  product_id uuid not null,
  price numeric(12,2) not null check (price >= 0),
  valid_from date not null,
  valid_to date,
  created_at timestamptz not null default now(),
  foreign key (organization_id, product_id) references public.products(organization_id, id) on delete restrict,
  unique (organization_id, id),
  check (valid_to is null or valid_to >= valid_from)
);
create unique index prices_current_unique on public.prices(organization_id, product_id) where valid_to is null;

create table public.production_map_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  producer_id uuid not null,
  product_id uuid not null,
  cycle_year smallint not null check (cycle_year between 2020 and 2200),
  month smallint not null check (month between 1 and 12),
  offered_qty numeric(12,2) not null default 0 check (offered_qty >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, producer_id) references public.producers(organization_id, id) on delete restrict,
  foreign key (organization_id, product_id) references public.products(organization_id, id) on delete restrict,
  unique (organization_id, cycle_year, month, producer_id, product_id)
);

create table public.weeks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  number bigint generated always as identity,
  reference_date date not null,
  start_date date not null,
  end_date date not null,
  status public.week_status not null default 'PLANEJAMENTO',
  billing_method public.billing_method not null default 'ACEITE_ESCOLAR',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  activated_at timestamptz,
  closed_at timestamptz,
  closed_by uuid references auth.users(id) on delete restrict,
  unique (organization_id, number),
  unique (organization_id, id),
  check (start_date <= reference_date and reference_date <= end_date),
  check ((status = 'FECHADO' and closed_at is not null and closed_by is not null) or (status <> 'FECHADO' and closed_at is null and closed_by is null))
);
create unique index weeks_one_open_per_org on public.weeks(organization_id) where status = 'ABERTO';

create or replace function private.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users for each row execute function private.handle_new_user();

create or replace function private.is_member(p_organization_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_members m
    join public.organizations o on o.id = m.organization_id
    where m.organization_id = p_organization_id
      and m.user_id = (select auth.uid())
      and m.active and o.active
  );
$$;

create or replace function private.has_role(p_organization_id uuid, p_roles public.member_role[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = p_organization_id
      and m.user_id = (select auth.uid())
      and m.active and m.role = any(p_roles)
  );
$$;

revoke all on schema private from public;
grant usage on schema private to authenticated;
revoke execute on all functions in schema private from public;
grant execute on function private.is_member(uuid) to authenticated;
grant execute on function private.has_role(uuid, public.member_role[]) to authenticated;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'organizations','profiles','organization_members','organization_settings','products','schools',
    'producers','return_reasons','production_map_entries','weeks'
  ] loop
    execute format('create trigger %I_touch before update on public.%I for each row execute function private.touch_updated_at()', table_name, table_name);
  end loop;
end $$;

commit;
