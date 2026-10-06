begin;

insert into auth.users(id,email,raw_user_meta_data)
values ('00000000-0000-4000-8000-000000000100','operador@teste.local','{"name":"Operador"}');
insert into public.organizations(id,name,slug) values
('00000000-0000-4000-8000-000000000001','Cooperativa A','cooperativa-a'),
('00000000-0000-4000-8000-000000000009','Cooperativa B','cooperativa-b');
insert into public.organization_members(organization_id,user_id,role)
values ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000100','OPERADOR');

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000100',true);

do $$
declare v_org uuid := '00000000-0000-4000-8000-000000000001';
declare v_empty uuid := '00000000-0000-4000-8000-000000000007';
declare v_week uuid := '00000000-0000-4000-8000-000000000006';
declare v_ledger jsonb; v_result jsonb;
begin
  if (select count(*) from public.organizations) <> 1 then raise exception 'RLS falhou'; end if;
  insert into public.products(id,organization_id,slug,name,unit) values ('00000000-0000-4000-8000-000000000002',v_org,'alface','Alface','kg');
  insert into public.schools(id,organization_id,code,name) values ('00000000-0000-4000-8000-000000000003',v_org,'E1','Escola 1');
  insert into public.producers(id,organization_id,internal_id,name) values ('00000000-0000-4000-8000-000000000004',v_org,'P1','Produtor 1');
  insert into public.return_reasons(id,organization_id,code,description) values ('00000000-0000-4000-8000-000000000005',v_org,1,'Produto rejeitado');
  perform public.set_product_price(v_org,'{"productId":"00000000-0000-4000-8000-000000000002","price":8,"validFrom":"2026-10-01"}'::jsonb);

  insert into public.weeks(id,organization_id,reference_date,start_date,end_date) values (v_empty,v_org,'2026-09-28','2026-09-24','2026-09-30');
  perform public.activate_week(v_org,v_empty);
  v_result := public.close_week(v_org,v_empty);
  if (v_result->>'closed')::boolean then raise exception 'Ciclo vazio não pode fechar'; end if;
  insert into public.school_orders(organization_id,week_id,school_id,product_id,ordered_qty,unit_price_snapshot)
  values (v_org,v_empty,'00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000002',0,8);
  v_result := public.close_week(v_org,v_empty);
  if not (v_result->>'closed')::boolean then raise exception 'Pedido zero não deveria exigir entrega'; end if;

  insert into public.weeks(id,organization_id,reference_date,start_date,end_date) values (v_week,v_org,'2026-10-05','2026-10-01','2026-10-07');
  perform public.activate_week(v_org,v_week);
  insert into public.school_orders(organization_id,week_id,school_id,product_id,ordered_qty,unit_price_snapshot)
  values (v_org,v_week,'00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000002',200,8);
  perform public.record_warehouse_receipt(v_org,v_week,'{"producerId":"00000000-0000-4000-8000-000000000004","productId":"00000000-0000-4000-8000-000000000002","grossQty":200,"rejectedQty":20,"rejectionReasonId":"00000000-0000-4000-8000-000000000005","unitPriceSnapshot":8,"logisticsDeductionSnapshot":3.67,"idempotencyKey":"receipt-final-001"}'::jsonb);
  perform public.execute_cycle_command(v_org,v_week,'{"type":"REGISTRAR_ENTREGA_INICIAL","idempotencyKey":"school-final-001","schoolId":"00000000-0000-4000-8000-000000000003","productId":"00000000-0000-4000-8000-000000000002","presentedQty":180,"rejectedQty":10,"rejectionReasonId":"00000000-0000-4000-8000-000000000005","lossBeforeSchoolQty":0}'::jsonb);
  v_ledger := public.get_cycle_ledger(v_org,v_week);
  if (v_ledger#>>'{financial,receivable}')::numeric <> 1360 then raise exception 'Cobrança incorreta'; end if;
  if (v_ledger#>>'{financial,payable}')::numeric <> 779.40 then raise exception 'Pagamento incorreto'; end if;
  if private.current_shortage(v_org,v_week,'00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000002') <> 30 then raise exception 'Falta incorreta'; end if;
  v_result := public.close_week(v_org,v_week);
  if (v_result->>'closed')::boolean then raise exception 'Fechou com falta sem decisão'; end if;
  perform public.execute_cycle_command(v_org,v_week,'{"type":"ENCERRAR_FALTA_SEM_ATENDIMENTO","schoolId":"00000000-0000-4000-8000-000000000003","productId":"00000000-0000-4000-8000-000000000002","reason":"Sem oferta","expectedShortageQty":30,"expectedVersion":null}'::jsonb);
  v_result := public.close_week(v_org,v_week);
  if not (v_result->>'closed')::boolean then raise exception 'Não fechou após decisão'; end if;
  if not exists (select 1 from public.audit_logs where organization_id=v_org and reason='Sem oferta') then raise exception 'Motivo não foi auditado'; end if;
end $$;

rollback;
