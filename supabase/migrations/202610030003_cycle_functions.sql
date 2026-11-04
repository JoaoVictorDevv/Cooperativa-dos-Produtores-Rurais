begin;

create or replace function private.current_shortage(
  p_organization_id uuid, p_week_id uuid, p_school_id uuid, p_product_id uuid
)
returns numeric language plpgsql stable set search_path = '' as $$
declare v_ordered numeric; v_accepted numeric; v_pending boolean;
begin
  select ordered_qty into v_ordered
  from public.school_orders
  where organization_id = p_organization_id and week_id = p_week_id
    and school_id = p_school_id and product_id = p_product_id;
  if not found then return null; end if;

  select
    bool_or(presented_qty is null) filter (where trip is distinct from 'MESMA_VIAGEM'),
    coalesce(sum(presented_qty - rejected_qty) filter (where trip is distinct from 'MESMA_VIAGEM' and presented_qty is not null), 0)
  into v_pending, v_accepted
  from public.school_delivery_events
  where organization_id = p_organization_id and week_id = p_week_id
    and school_id = p_school_id and product_id = p_product_id;

  if not exists (
    select 1 from public.school_delivery_events
    where organization_id = p_organization_id and week_id = p_week_id
      and school_id = p_school_id and product_id = p_product_id and kind = 'INICIAL'
  ) or coalesce(v_pending, false) then return null; end if;
  return round(greatest(v_ordered - v_accepted, 0), 2);
end;
$$;

create or replace function public.activate_week(p_organization_id uuid, p_week_id uuid)
returns public.weeks language plpgsql security invoker set search_path = '' as $$
declare v_week public.weeks;
begin
  if not private.has_role(p_organization_id, array['ADMIN','OPERADOR']::public.member_role[]) then
    raise exception 'Sem permissão para ativar ciclo' using errcode = '42501';
  end if;
  perform set_config('app.audit_action','ATIVAR_CICLO',true);
  update public.weeks set status = 'ABERTO', activated_at = now()
  where id = p_week_id and organization_id = p_organization_id and status = 'PLANEJAMENTO'
  returning * into v_week;
  if not found then raise exception 'Ciclo em planejamento não encontrado' using errcode = 'P0001'; end if;
  return v_week;
end;
$$;

create or replace function public.record_warehouse_receipt(
  p_organization_id uuid, p_week_id uuid, p_input jsonb
)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_existing public.warehouse_receipts; v_receipt public.warehouse_receipts;
begin
  if not private.has_role(p_organization_id, array['ADMIN','OPERADOR']::public.member_role[]) then
    raise exception 'Sem permissão para registrar recebimento' using errcode = '42501';
  end if;
  perform 1 from public.weeks where id = p_week_id and organization_id = p_organization_id and status = 'ABERTO' for update;
  if not found then raise exception 'Ciclo não está aberto' using errcode = 'P0001'; end if;

  perform set_config('app.audit_action','REGISTRAR_RECEBIMENTO_GALPAO',true);
  select * into v_existing from public.warehouse_receipts
  where organization_id = p_organization_id and week_id = p_week_id
    and idempotency_key = p_input->>'idempotencyKey';
  if found then
    if v_existing.command_payload <> p_input then
      raise exception 'Chave de envio já usada com conteúdo diferente' using errcode = 'P0001';
    end if;
    return jsonb_build_object('effect','JA_REGISTRADO','receipt',to_jsonb(v_existing));
  end if;

  insert into public.warehouse_receipts(
    organization_id, week_id, producer_id, product_id, gross_qty, rejected_qty,
    rejection_reason_id, unit_price_snapshot, logistics_deduction_snapshot,
    delivered_at, idempotency_key, command_payload, created_by
  ) values (
    p_organization_id, p_week_id, (p_input->>'producerId')::uuid, (p_input->>'productId')::uuid,
    (p_input->>'grossQty')::numeric, coalesce((p_input->>'rejectedQty')::numeric, 0),
    nullif(p_input->>'rejectionReasonId','')::uuid, (p_input->>'unitPriceSnapshot')::numeric,
    (p_input->>'logisticsDeductionSnapshot')::numeric, nullif(p_input->>'deliveredAt','')::timestamptz,
    p_input->>'idempotencyKey', p_input, (select auth.uid())
  ) returning * into v_receipt;
  return jsonb_build_object('effect','APLICADO','receipt',to_jsonb(v_receipt));
end;
$$;

create or replace function public.execute_cycle_command(
  p_organization_id uuid, p_week_id uuid, p_command jsonb
)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_type text := p_command->>'type';
  v_existing public.school_delivery_events;
  v_event public.school_delivery_events;
  v_decision public.shortage_decisions;
  v_changes jsonb;
  v_shortage numeric;
  v_initial_qty numeric;
  v_same_trip_qty numeric;
  v_expected_version integer;
begin
  if not private.has_role(p_organization_id, array['ADMIN','OPERADOR']::public.member_role[]) then
    raise exception 'Sem permissão para alterar o ciclo' using errcode = '42501';
  end if;
  perform 1 from public.weeks where id = p_week_id and organization_id = p_organization_id and status = 'ABERTO' for update;
  if not found then raise exception 'Ciclo não está aberto' using errcode = 'P0001'; end if;
  perform set_config('app.audit_action',coalesce(v_type,'COMANDO_DESCONHECIDO'),true);
  if v_type in ('CORRIGIR_EVENTO','MARCAR_FALTA_EM_RESOLUCAO','ENCERRAR_FALTA_SEM_ATENDIMENTO','REVOGAR_DECISAO_FALTA') then
    perform set_config('app.audit_reason',coalesce(p_command->>'reason',''),true);
  end if;

  if v_type in ('REGISTRAR_ENTREGA_INICIAL','REGISTRAR_COMPLEMENTO') then
    select * into v_existing from public.school_delivery_events
    where organization_id = p_organization_id and week_id = p_week_id
      and idempotency_key = p_command->>'idempotencyKey';
    if found then
      if v_existing.command_payload <> p_command then
        raise exception 'Chave de envio já usada com conteúdo diferente' using errcode = 'P0001';
      end if;
      return jsonb_build_object('effect','JA_REGISTRADO','event',to_jsonb(v_existing),'warnings','[]'::jsonb);
    end if;

    insert into public.school_delivery_events(
      organization_id, week_id, school_id, product_id, kind, presented_qty, rejected_qty,
      rejection_reason_id, loss_before_school_qty, loss_reason_id, source_type,
      source_producer_id, trip, delivered_at, received_by, idempotency_key,
      command_payload, created_by
    ) values (
      p_organization_id, p_week_id, (p_command->>'schoolId')::uuid, (p_command->>'productId')::uuid,
      case when v_type = 'REGISTRAR_ENTREGA_INICIAL' then 'INICIAL' else 'COMPLEMENTO' end::public.delivery_event_kind,
      (p_command->>'presentedQty')::numeric, coalesce((p_command->>'rejectedQty')::numeric,0),
      nullif(p_command->>'rejectionReasonId','')::uuid, coalesce((p_command->>'lossBeforeSchoolQty')::numeric,0),
      nullif(p_command->>'lossReasonId','')::uuid, nullif(p_command#>>'{source,type}','')::public.supply_source_type,
      nullif(p_command#>>'{source,producerId}','')::uuid, nullif(p_command->>'trip','')::public.complement_trip,
      nullif(p_command->>'deliveredAt','')::timestamptz, nullif(p_command->>'receivedBy',''),
      p_command->>'idempotencyKey', p_command, (select auth.uid())
    ) returning * into v_event;

    if v_event.trip = 'MESMA_VIAGEM' then
      select presented_qty into v_initial_qty from public.school_delivery_events
      where organization_id = p_organization_id and week_id = p_week_id and school_id = v_event.school_id
        and product_id = v_event.product_id and kind = 'INICIAL' for update;
      select coalesce(sum(presented_qty),0) into v_same_trip_qty from public.school_delivery_events
      where organization_id = p_organization_id and week_id = p_week_id and school_id = v_event.school_id
        and product_id = v_event.product_id and trip = 'MESMA_VIAGEM';
      if v_initial_qty is null or v_same_trip_qty > v_initial_qty then
        raise exception 'Complementos da mesma viagem superam o total do romaneio inicial' using errcode = 'P0001';
      end if;
    end if;
    return jsonb_build_object('effect','APLICADO','event',to_jsonb(v_event),'warnings','[]'::jsonb);
  end if;

  if v_type = 'CORRIGIR_EVENTO' then
    select * into v_event from public.school_delivery_events
    where id = (p_command->>'eventId')::uuid and organization_id = p_organization_id and week_id = p_week_id for update;
    if not found then raise exception 'Evento não encontrado' using errcode = 'P0001'; end if;
    v_expected_version := (p_command->>'expectedVersion')::integer;
    if v_event.version <> v_expected_version then raise exception 'Evento foi alterado por outra pessoa' using errcode = 'P0001'; end if;
    v_changes := p_command->'changes';
    update public.school_delivery_events set
      presented_qty = case when v_changes ? 'presentedQty' then (v_changes->>'presentedQty')::numeric else presented_qty end,
      rejected_qty = case when v_changes ? 'rejectedQty' then (v_changes->>'rejectedQty')::numeric else rejected_qty end,
      rejection_reason_id = case when v_changes ? 'rejectionReasonId' then nullif(v_changes->>'rejectionReasonId','')::uuid else rejection_reason_id end,
      loss_before_school_qty = case when v_changes ? 'lossBeforeSchoolQty' then (v_changes->>'lossBeforeSchoolQty')::numeric else loss_before_school_qty end,
      loss_reason_id = case when v_changes ? 'lossReasonId' then nullif(v_changes->>'lossReasonId','')::uuid else loss_reason_id end,
      source_type = case when v_changes ? 'source' then nullif(v_changes#>>'{source,type}','')::public.supply_source_type else source_type end,
      source_producer_id = case when v_changes ? 'source' then nullif(v_changes#>>'{source,producerId}','')::uuid else source_producer_id end,
      trip = case when v_changes ? 'trip' then nullif(v_changes->>'trip','')::public.complement_trip else trip end,
      delivered_at = case when v_changes ? 'deliveredAt' then nullif(v_changes->>'deliveredAt','')::timestamptz else delivered_at end,
      received_by = case when v_changes ? 'receivedBy' then nullif(v_changes->>'receivedBy','') else received_by end,
      version = version + 1
    where id = v_event.id returning * into v_event;
    return jsonb_build_object('effect','APLICADO','event',to_jsonb(v_event),'warnings','[]'::jsonb);
  end if;

  if v_type in ('MARCAR_FALTA_EM_RESOLUCAO','ENCERRAR_FALTA_SEM_ATENDIMENTO') then
    v_shortage := private.current_shortage(p_organization_id, p_week_id, (p_command->>'schoolId')::uuid, (p_command->>'productId')::uuid);
    if v_shortage is null then raise exception 'Entrega inicial ainda não foi conferida' using errcode = 'P0001'; end if;
    if v_shortage <= 0 then raise exception 'A linha não possui falta' using errcode = 'P0001'; end if;
    if v_type = 'ENCERRAR_FALTA_SEM_ATENDIMENTO' and round((p_command->>'expectedShortageQty')::numeric,2) <> v_shortage then
      raise exception 'A falta mudou desde que a tela foi aberta' using errcode = 'P0001';
    end if;
    select * into v_decision from public.shortage_decisions
    where organization_id = p_organization_id and week_id = p_week_id
      and school_id = (p_command->>'schoolId')::uuid and product_id = (p_command->>'productId')::uuid for update;
    if found and p_command->>'expectedVersion' is not null and v_decision.version <> (p_command->>'expectedVersion')::integer then
      raise exception 'Decisão foi alterada por outra pessoa' using errcode = 'P0001';
    end if;
    insert into public.shortage_decisions(
      organization_id, week_id, school_id, product_id, kind, reason,
      shortage_qty_at_decision, version, decided_by, decided_at
    ) values (
      p_organization_id, p_week_id, (p_command->>'schoolId')::uuid, (p_command->>'productId')::uuid,
      case when v_type = 'MARCAR_FALTA_EM_RESOLUCAO' then 'EM_RESOLUCAO' else 'ENCERRADA_SEM_ATENDIMENTO' end::public.shortage_decision_kind,
      coalesce(p_command->>'reason',''), case when v_type = 'ENCERRAR_FALTA_SEM_ATENDIMENTO' then v_shortage else null end,
      coalesce(v_decision.version + 1, 1), (select auth.uid()), now()
    ) on conflict (organization_id, week_id, school_id, product_id) do update set
      kind = excluded.kind, reason = excluded.reason, shortage_qty_at_decision = excluded.shortage_qty_at_decision,
      version = excluded.version, decided_by = excluded.decided_by, decided_at = excluded.decided_at
    returning * into v_decision;
    return jsonb_build_object('effect','APLICADO','decision',to_jsonb(v_decision),'warnings','[]'::jsonb);
  end if;

  if v_type = 'REVOGAR_DECISAO_FALTA' then
    delete from public.shortage_decisions
    where organization_id = p_organization_id and week_id = p_week_id
      and school_id = (p_command->>'schoolId')::uuid and product_id = (p_command->>'productId')::uuid
      and version = (p_command->>'expectedVersion')::integer returning * into v_decision;
    if not found then raise exception 'Decisão não encontrada ou versão desatualizada' using errcode = 'P0001'; end if;
    return jsonb_build_object('effect','APLICADO','warnings','[]'::jsonb);
  end if;

  raise exception 'Comando não suportado: %', coalesce(v_type,'(vazio)') using errcode = 'P0001';
end;
$$;

create or replace function public.get_cycle_ledger(p_organization_id uuid, p_week_id uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'cycle', to_jsonb(w),
    'orders', coalesce((select jsonb_agg(to_jsonb(o) order by o.created_at) from public.school_orders o where o.organization_id=w.organization_id and o.week_id=w.id),'[]'::jsonb),
    'warehouseReceipts', coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at) from public.warehouse_receipts r where r.organization_id=w.organization_id and r.week_id=w.id),'[]'::jsonb),
    'events', coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at) from public.school_delivery_events e where e.organization_id=w.organization_id and e.week_id=w.id),'[]'::jsonb),
    'decisions', coalesce((select jsonb_agg(to_jsonb(d) order by d.decided_at) from public.shortage_decisions d where d.organization_id=w.organization_id and d.week_id=w.id),'[]'::jsonb),
    'financial', jsonb_build_object(
      'receivable', coalesce((select sum(round(greatest(0, coalesce((select sum(e.presented_qty-e.rejected_qty) from public.school_delivery_events e where e.organization_id=o.organization_id and e.week_id=o.week_id and e.school_id=o.school_id and e.product_id=o.product_id and e.trip is distinct from 'MESMA_VIAGEM'),0)) * o.unit_price_snapshot,2)) from public.school_orders o where o.organization_id=w.organization_id and o.week_id=w.id),0),
      'payable', coalesce((select sum(round(r.accepted_qty * greatest(r.unit_price_snapshot-r.logistics_deduction_snapshot,0),2)) from public.warehouse_receipts r where r.organization_id=w.organization_id and r.week_id=w.id and r.accepted_qty is not null),0),
      'costs', coalesce((select sum(c.amount) from public.weekly_costs c where c.organization_id=w.organization_id and c.week_id=w.id),0)
    )
  )
  from public.weeks w
  where w.organization_id=p_organization_id and w.id=p_week_id;
$$;

create or replace function public.close_week(p_organization_id uuid, p_week_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_blockers jsonb := '[]'::jsonb; v_week public.weeks; v_ledger jsonb;
begin
  if not private.has_role(p_organization_id, array['ADMIN','OPERADOR']::public.member_role[]) then
    raise exception 'Sem permissão para fechar ciclo' using errcode = '42501';
  end if;
  select * into v_week from public.weeks where organization_id=p_organization_id and id=p_week_id for update;
  if not found or v_week.status <> 'ABERTO' then raise exception 'Ciclo não está aberto' using errcode = 'P0001'; end if;
  perform set_config('app.audit_action','FECHAR_CICLO',true);

  if not exists (
    select 1 from public.school_orders o
    where o.organization_id=p_organization_id and o.week_id=p_week_id
  ) then v_blockers := v_blockers || '"O ciclo ainda não possui pedido."'::jsonb; end if;

  if exists (
    select 1 from public.school_orders o
    left join public.school_delivery_events e on e.organization_id=o.organization_id and e.week_id=o.week_id and e.school_id=o.school_id and e.product_id=o.product_id and e.kind='INICIAL'
    where o.organization_id=p_organization_id and o.week_id=p_week_id and o.ordered_qty > 0
      and (e.id is null or e.presented_qty is null)
  ) then v_blockers := v_blockers || '"Há pedidos sem entrega inicial conferida."'::jsonb; end if;

  if exists (
    select 1 from public.school_delivery_events e
    where e.organization_id=p_organization_id and e.week_id=p_week_id
      and e.trip is distinct from 'MESMA_VIAGEM' and e.presented_qty is null
  ) then v_blockers := v_blockers || '"Há eventos com quantidade ainda não informada."'::jsonb; end if;

  if exists (
    select 1 from public.school_orders o
    left join public.shortage_decisions d on d.organization_id=o.organization_id and d.week_id=o.week_id and d.school_id=o.school_id and d.product_id=o.product_id
    where o.organization_id=p_organization_id and o.week_id=p_week_id
      and private.current_shortage(o.organization_id,o.week_id,o.school_id,o.product_id) > 0
      and (d.kind is distinct from 'ENCERRADA_SEM_ATENDIMENTO' or d.shortage_qty_at_decision <> private.current_shortage(o.organization_id,o.week_id,o.school_id,o.product_id))
  ) then v_blockers := v_blockers || '"Há faltas sem encerramento coerente."'::jsonb; end if;

  if exists (
    select 1 from public.school_delivery_events e
    where e.organization_id=p_organization_id and e.week_id=p_week_id and e.source_type='PRODUTOR'
      and not exists (
        select 1 from public.warehouse_receipts r where r.organization_id=e.organization_id and r.week_id=e.week_id
          and r.producer_id=e.source_producer_id and r.product_id=e.product_id and r.accepted_qty is not null
      )
  ) then v_blockers := v_blockers || '"Há complemento de produtor sem recebimento conferido no galpão."'::jsonb; end if;

  if jsonb_array_length(v_blockers) > 0 then
    return jsonb_build_object('closed',false,'blockers',v_blockers);
  end if;
  update public.weeks set status='FECHADO', closed_at=now(), closed_by=(select auth.uid())
  where id=p_week_id and organization_id=p_organization_id returning * into v_week;
  v_ledger := public.get_cycle_ledger(p_organization_id,p_week_id);
  return jsonb_build_object('closed',true,'week',to_jsonb(v_week),'preview',v_ledger->'financial','blockers','[]'::jsonb);
end;
$$;

grant execute on function public.activate_week(uuid,uuid) to authenticated;
grant execute on function public.record_warehouse_receipt(uuid,uuid,jsonb) to authenticated;
grant execute on function public.execute_cycle_command(uuid,uuid,jsonb) to authenticated;
grant execute on function public.get_cycle_ledger(uuid,uuid) to authenticated;
grant execute on function public.close_week(uuid,uuid) to authenticated;
grant execute on function private.current_shortage(uuid,uuid,uuid,uuid) to authenticated;

commit;
