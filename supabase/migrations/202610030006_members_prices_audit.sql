begin;

alter table public.profiles add column email text;
insert into public.profiles(id,name,email)
select u.id, coalesce(u.raw_user_meta_data->>'name',''), u.email from auth.users u
on conflict (id) do update set email=excluded.email;

create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', ''), new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

alter table public.organization_members
  add constraint organization_members_profile_fk
  foreign key (user_id) references public.profiles(id) on delete cascade;

create or replace function private.shares_organization(p_other_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.organization_members mine
    join public.organization_members theirs on theirs.organization_id = mine.organization_id
    where mine.user_id = (select auth.uid()) and mine.active
      and theirs.user_id = p_other_user_id and theirs.active
  );
$$;
revoke execute on function private.shares_organization(uuid) from public;
grant execute on function private.shares_organization(uuid) to authenticated;

create policy profiles_read_same_organization on public.profiles
for select to authenticated using (private.shares_organization(id));

create or replace function public.set_product_price(p_organization_id uuid, p_input jsonb)
returns public.prices language plpgsql security invoker set search_path = '' as $$
declare v_product_id uuid := (p_input->>'productId')::uuid;
declare v_valid_from date := (p_input->>'validFrom')::date;
declare v_price public.prices;
begin
  if not private.has_role(p_organization_id, array['ADMIN','OPERADOR']::public.member_role[]) then
    raise exception 'Sem permissão para alterar preços' using errcode='42501';
  end if;
  perform set_config('app.audit_action','ALTERAR_PRECO',true);
  perform 1 from public.products
  where organization_id=p_organization_id and id=v_product_id for update;
  if not found then raise exception 'Produto não encontrado' using errcode='P0001'; end if;
  if exists (
    select 1 from public.prices where organization_id=p_organization_id and product_id=v_product_id
      and valid_to is null and valid_from >= v_valid_from
  ) then raise exception 'A vigência nova deve ser posterior à vigente' using errcode='P0001'; end if;
  update public.prices set valid_to = v_valid_from - 1
  where organization_id=p_organization_id and product_id=v_product_id and valid_to is null;
  insert into public.prices(organization_id,product_id,price,valid_from)
  values (p_organization_id,v_product_id,(p_input->>'price')::numeric,v_valid_from)
  returning * into v_price;
  return v_price;
end;
$$;
revoke execute on function public.set_product_price(uuid,jsonb) from public;
grant execute on function public.set_product_price(uuid,jsonb) to authenticated;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'organization_members','organization_settings','products','schools','producers',
    'return_reasons','prices','production_map_entries','weeks'
  ] loop
    execute format('create trigger %I_audit after insert or update or delete on public.%I for each row execute function private.audit_row()', table_name, table_name);
  end loop;
end $$;

commit;
