begin;

create table public.school_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  week_id uuid not null,
  school_id uuid not null,
  product_id uuid not null,
  ordered_qty numeric(12,2) not null check (ordered_qty >= 0),
  unit_price_snapshot numeric(12,2) not null check (unit_price_snapshot >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, week_id) references public.weeks(organization_id, id) on delete restrict,
  foreign key (organization_id, school_id) references public.schools(organization_id, id) on delete restrict,
  foreign key (organization_id, product_id) references public.products(organization_id, id) on delete restrict,
  unique (organization_id, week_id, school_id, product_id),
  unique (organization_id, id)
);

create table public.producer_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  week_id uuid not null,
  producer_id uuid not null,
  product_id uuid not null,
  ordered_qty numeric(12,2) not null check (ordered_qty >= 0),
  unit_price_snapshot numeric(12,2) not null check (unit_price_snapshot >= 0),
  logistics_deduction_snapshot numeric(12,2) not null check (logistics_deduction_snapshot >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, week_id) references public.weeks(organization_id, id) on delete restrict,
  foreign key (organization_id, producer_id) references public.producers(organization_id, id) on delete restrict,
  foreign key (organization_id, product_id) references public.products(organization_id, id) on delete restrict,
  unique (organization_id, week_id, producer_id, product_id),
  unique (organization_id, id)
);

create table public.warehouse_receipts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  week_id uuid not null,
  producer_id uuid not null,
  product_id uuid not null,
  gross_qty numeric(12,2) check (gross_qty is null or gross_qty >= 0),
  rejected_qty numeric(12,2) not null default 0 check (rejected_qty >= 0),
  accepted_qty numeric(12,2) generated always as (
    case when gross_qty is null then null else gross_qty - rejected_qty end
  ) stored,
  rejection_reason_id uuid,
  unit_price_snapshot numeric(12,2) not null check (unit_price_snapshot >= 0),
  logistics_deduction_snapshot numeric(12,2) not null check (logistics_deduction_snapshot >= 0),
  delivered_at timestamptz,
  idempotency_key text not null check (length(idempotency_key) between 8 and 100),
  command_payload jsonb not null,
  version integer not null default 1 check (version > 0),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, week_id) references public.weeks(organization_id, id) on delete restrict,
  foreign key (organization_id, producer_id) references public.producers(organization_id, id) on delete restrict,
  foreign key (organization_id, product_id) references public.products(organization_id, id) on delete restrict,
  foreign key (organization_id, rejection_reason_id) references public.return_reasons(organization_id, id) on delete restrict,
  unique (organization_id, week_id, idempotency_key),
  unique (organization_id, id),
  check (gross_qty is null or rejected_qty <= gross_qty),
  check ((rejected_qty = 0) or rejection_reason_id is not null)
);

create table public.school_delivery_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  week_id uuid not null,
  school_id uuid not null,
  product_id uuid not null,
  kind public.delivery_event_kind not null,
  presented_qty numeric(12,2) check (presented_qty is null or presented_qty >= 0),
  rejected_qty numeric(12,2) not null default 0 check (rejected_qty >= 0),
  rejection_reason_id uuid,
  loss_before_school_qty numeric(12,2) not null default 0 check (loss_before_school_qty >= 0),
  loss_reason_id uuid,
  source_type public.supply_source_type,
  source_producer_id uuid,
  trip public.complement_trip,
  delivered_at timestamptz,
  received_by text,
  idempotency_key text not null check (length(idempotency_key) between 8 and 100),
  command_payload jsonb not null,
  version integer not null default 1 check (version > 0),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, week_id) references public.weeks(organization_id, id) on delete restrict,
  foreign key (organization_id, school_id) references public.schools(organization_id, id) on delete restrict,
  foreign key (organization_id, product_id) references public.products(organization_id, id) on delete restrict,
  foreign key (organization_id, source_producer_id) references public.producers(organization_id, id) on delete restrict,
  foreign key (organization_id, rejection_reason_id) references public.return_reasons(organization_id, id) on delete restrict,
  foreign key (organization_id, loss_reason_id) references public.return_reasons(organization_id, id) on delete restrict,
  unique (organization_id, week_id, idempotency_key),
  unique (organization_id, id),
  check (presented_qty is null or rejected_qty <= presented_qty),
  check ((rejected_qty = 0) or rejection_reason_id is not null),
  check ((loss_before_school_qty = 0) or loss_reason_id is not null),
  check ((source_type = 'PRODUTOR' and source_producer_id is not null) or (source_type = 'SALDO_GALPAO' and source_producer_id is null) or source_type is null),
  check ((kind = 'INICIAL' and trip is null) or (kind = 'COMPLEMENTO' and trip is not null and source_type is not null)),
  check (trip <> 'MESMA_VIAGEM' or (rejected_qty = 0 and loss_before_school_qty = 0 and delivered_at is null and received_by is null))
);
create unique index school_delivery_one_initial on public.school_delivery_events(organization_id, week_id, school_id, product_id) where kind = 'INICIAL';
create index school_delivery_line_idx on public.school_delivery_events(organization_id, week_id, school_id, product_id);

create table public.shortage_decisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  week_id uuid not null,
  school_id uuid not null,
  product_id uuid not null,
  kind public.shortage_decision_kind not null,
  reason text not null default '',
  shortage_qty_at_decision numeric(12,2),
  version integer not null default 1 check (version > 0),
  decided_by uuid not null references auth.users(id) on delete restrict,
  decided_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, week_id) references public.weeks(organization_id, id) on delete restrict,
  foreign key (organization_id, school_id) references public.schools(organization_id, id) on delete restrict,
  foreign key (organization_id, product_id) references public.products(organization_id, id) on delete restrict,
  unique (organization_id, week_id, school_id, product_id),
  check ((kind = 'EM_RESOLUCAO' and shortage_qty_at_decision is null) or (kind = 'ENCERRADA_SEM_ATENDIMENTO' and shortage_qty_at_decision is not null and shortage_qty_at_decision > 0 and length(trim(reason)) >= 3))
);

create table public.weekly_costs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  week_id uuid not null,
  category text not null check (length(trim(category)) between 2 and 80),
  amount numeric(14,2) not null check (amount >= 0),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, week_id) references public.weeks(organization_id, id) on delete restrict
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  reason text,
  request_id uuid,
  created_at timestamptz not null default now()
);
create index audit_logs_org_created_idx on public.audit_logs(organization_id, created_at desc);
create index audit_logs_entity_idx on public.audit_logs(organization_id, entity_type, entity_id);

create or replace function private.ensure_week_not_closed()
returns trigger language plpgsql set search_path = '' as $$
declare v_week_id uuid := coalesce(new.week_id, old.week_id);
begin
  if exists (select 1 from public.weeks where id = v_week_id and status = 'FECHADO') then
    raise exception 'Ciclo fechado não pode receber alterações' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end;
$$;

create or replace function private.ensure_open_week()
returns trigger language plpgsql set search_path = '' as $$
declare v_week_id uuid := coalesce(new.week_id, old.week_id);
begin
  if not exists (select 1 from public.weeks where id = v_week_id and status = 'ABERTO') then
    raise exception 'Recebimentos e entregas exigem ciclo aberto' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end;
$$;

create or replace function private.audit_row()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_row jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
begin
  insert into public.audit_logs(organization_id, user_id, action, entity_type, entity_id, before_data, after_data, reason)
  values (
    (v_row->>'organization_id')::uuid,
    (select auth.uid()),
    coalesce(nullif(current_setting('app.audit_action', true), ''), tg_op),
    tg_table_name,
    nullif(v_row->>'id', '')::uuid,
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end,
    nullif(current_setting('app.audit_reason', true), '')
  );
  return coalesce(new, old);
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array['school_orders','producer_orders','warehouse_receipts','school_delivery_events','shortage_decisions','weekly_costs'] loop
    execute format('create trigger %I_not_closed before insert or update or delete on public.%I for each row execute function private.ensure_week_not_closed()', table_name, table_name);
    execute format('create trigger %I_touch before update on public.%I for each row execute function private.touch_updated_at()', table_name, table_name);
    execute format('create trigger %I_audit after insert or update or delete on public.%I for each row execute function private.audit_row()', table_name, table_name);
  end loop;
  foreach table_name in array array['warehouse_receipts','school_delivery_events','shortage_decisions'] loop
    execute format('create trigger %I_open before insert or update or delete on public.%I for each row execute function private.ensure_open_week()', table_name, table_name);
  end loop;
end $$;

commit;
