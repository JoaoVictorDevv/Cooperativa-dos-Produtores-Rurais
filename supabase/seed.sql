-- Seed intencionalmente sem usuários ou senhas.
-- O Supabase Auth cria usuários; o primeiro vínculo ADMIN deve ser feito pelo
-- responsável do projeto seguindo supabase/README.md. Nunca coloque senha,
-- service_role ou dados reais neste arquivo.

insert into public.organizations(id, name, slug, document)
values ('00000000-0000-4000-8000-000000000001', 'Cooperativa dos Produtores Rurais de Petrópolis', 'cooperativa-petropolis', null)
on conflict (id) do nothing;

insert into public.organization_settings(organization_id)
values ('00000000-0000-4000-8000-000000000001')
on conflict (organization_id) do nothing;
