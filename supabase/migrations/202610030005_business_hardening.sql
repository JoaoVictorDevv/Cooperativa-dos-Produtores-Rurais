begin;

alter table public.school_delivery_events
  add constraint complement_requires_positive_quantity
  check (kind <> 'COMPLEMENTO' or (presented_qty is not null and presented_qty > 0));

create or replace function private.validate_same_trip_total()
returns trigger language plpgsql set search_path = '' as $$
declare v_initial_qty numeric; v_sources numeric;
begin
  if new.kind = 'INICIAL' then
    select coalesce(sum(presented_qty),0) into v_sources
    from public.school_delivery_events
    where organization_id=new.organization_id and week_id=new.week_id
      and school_id=new.school_id and product_id=new.product_id
      and trip='MESMA_VIAGEM' and id <> new.id;
    if new.presented_qty is not null and v_sources > new.presented_qty then
      raise exception 'Complementos da mesma viagem superam o total do romaneio inicial' using errcode='P0001';
    end if;
  elsif new.trip = 'MESMA_VIAGEM' then
    select presented_qty into v_initial_qty
    from public.school_delivery_events
    where organization_id=new.organization_id and week_id=new.week_id
      and school_id=new.school_id and product_id=new.product_id and kind='INICIAL'
    for update;
    if v_initial_qty is null then
      raise exception 'Complemento da mesma viagem exige entrega inicial conferida' using errcode='P0001';
    end if;
    select coalesce(sum(presented_qty),0) into v_sources
    from public.school_delivery_events
    where organization_id=new.organization_id and week_id=new.week_id
      and school_id=new.school_id and product_id=new.product_id
      and trip='MESMA_VIAGEM' and id <> new.id;
    if v_sources + new.presented_qty > v_initial_qty then
      raise exception 'Complementos da mesma viagem superam o total do romaneio inicial' using errcode='P0001';
    end if;
  end if;
  return new;
end;
$$;

create trigger school_delivery_same_trip_limit
before insert or update on public.school_delivery_events
for each row execute function private.validate_same_trip_total();

create or replace function private.protect_warehouse_snapshot()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.unit_price_snapshot <> old.unit_price_snapshot
     or new.logistics_deduction_snapshot <> old.logistics_deduction_snapshot then
    raise exception 'Preço e desconto congelados não podem ser alterados' using errcode='P0001';
  end if;
  if new.version <> old.version + 1 then
    raise exception 'Atualização exige incremento único de versão' using errcode='P0001';
  end if;
  return new;
end;
$$;

create trigger warehouse_snapshot_immutable
before update on public.warehouse_receipts
for each row execute function private.protect_warehouse_snapshot();

commit;
