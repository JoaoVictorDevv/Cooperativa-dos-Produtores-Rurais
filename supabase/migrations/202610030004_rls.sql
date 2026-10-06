begin;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'organizations','profiles','organization_members','organization_settings','products','schools',
    'producers','return_reasons','prices','production_map_entries','weeks','school_orders',
    'producer_orders','warehouse_receipts','school_delivery_events','shortage_decisions','weekly_costs','audit_logs'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end $$;

create policy organizations_read_member on public.organizations
for select to authenticated using (private.is_member(id));

create policy profiles_read_self on public.profiles
for select to authenticated using (id = (select auth.uid()));
create policy profiles_update_self on public.profiles
for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy members_read_same_organization on public.organization_members
for select to authenticated using (private.is_member(organization_id));
create policy members_insert_admin on public.organization_members
for insert to authenticated with check (private.has_role(organization_id, array['ADMIN']::public.member_role[]));
create policy members_update_admin on public.organization_members
for update to authenticated using (private.has_role(organization_id, array['ADMIN']::public.member_role[]))
with check (private.has_role(organization_id, array['ADMIN']::public.member_role[]));

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'organization_settings','products','schools','producers','return_reasons','prices',
    'production_map_entries','weeks','school_orders','producer_orders','warehouse_receipts',
    'school_delivery_events','shortage_decisions','weekly_costs'
  ] loop
    execute format(
      'create policy %I_read_member on public.%I for select to authenticated using (private.is_member(organization_id))',
      table_name, table_name
    );
    execute format(
      'create policy %I_insert_operator on public.%I for insert to authenticated with check (private.has_role(organization_id, array[''ADMIN'',''OPERADOR'']::public.member_role[]))',
      table_name, table_name
    );
    execute format(
      'create policy %I_update_operator on public.%I for update to authenticated using (private.has_role(organization_id, array[''ADMIN'',''OPERADOR'']::public.member_role[])) with check (private.has_role(organization_id, array[''ADMIN'',''OPERADOR'']::public.member_role[]))',
      table_name, table_name
    );
  end loop;
end $$;

create policy audit_logs_read_admin_operator on public.audit_logs
for select to authenticated using (private.has_role(organization_id, array['ADMIN','OPERADOR']::public.member_role[]));

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;

grant usage on schema public to authenticated;
grant select on public.organizations, public.profiles, public.organization_members, public.organization_settings,
  public.products, public.schools, public.producers, public.return_reasons, public.prices,
  public.production_map_entries, public.weeks, public.school_orders, public.producer_orders,
  public.warehouse_receipts, public.school_delivery_events, public.shortage_decisions,
  public.weekly_costs, public.audit_logs to authenticated;
grant update(name) on public.profiles to authenticated;
grant insert, update on public.organization_members to authenticated;
grant insert, update on public.organization_settings, public.products, public.schools, public.producers,
  public.return_reasons, public.prices, public.production_map_entries, public.weeks,
  public.school_orders, public.producer_orders, public.warehouse_receipts,
  public.school_delivery_events, public.shortage_decisions, public.weekly_costs to authenticated;
grant usage, select on all sequences in schema public to authenticated;

revoke execute on function public.activate_week(uuid,uuid) from public;
revoke execute on function public.record_warehouse_receipt(uuid,uuid,jsonb) from public;
revoke execute on function public.execute_cycle_command(uuid,uuid,jsonb) from public;
revoke execute on function public.get_cycle_ledger(uuid,uuid) from public;
revoke execute on function public.close_week(uuid,uuid) from public;
grant execute on function public.activate_week(uuid,uuid) to authenticated;
grant execute on function public.record_warehouse_receipt(uuid,uuid,jsonb) to authenticated;
grant execute on function public.execute_cycle_command(uuid,uuid,jsonb) to authenticated;
grant execute on function public.get_cycle_ledger(uuid,uuid) to authenticated;
grant execute on function public.close_week(uuid,uuid) to authenticated;

commit;
