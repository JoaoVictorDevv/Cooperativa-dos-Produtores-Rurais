# Banco PostgreSQL no Supabase

Esta pasta é a fonte de verdade do banco novo. Não crie tabelas manualmente no
Dashboard: toda mudança deve virar uma migração versionada.

## Rodar localmente

Requer Docker Desktop e a CLI do Supabase:

```powershell
npx supabase start
npx supabase db reset
npx supabase status
```

O reset é destrutivo e deve ser usado somente na instância local descartável.

## Publicar em um projeto novo

```powershell
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase db push --dry-run
npx supabase db push
```

Não use `--include-seed` em produção. Crie a organização real com dados
conferidos.

## Primeiro administrador

1. Em Authentication > Users, convide/crie o usuário real.
2. Copie o UUID do usuário e o UUID da organização.
3. No SQL Editor, execute uma única vez, substituindo os dois valores:

```sql
insert into public.organization_members(organization_id, user_id, role)
values ('UUID_DA_ORGANIZACAO', 'UUID_DO_USUARIO', 'ADMIN');
```

Depois disso, o ADMIN cadastra os demais membros pelo fluxo administrativo que
será ligado à API. Não existe usuário ou senha padrão no repositório.

## Variáveis da API

Copie `api/.env.example` para `api/.env` e informe a URL e a chave publicável.
A API não precisa da `service_role` para operar: ela encaminha o token do
usuário e o RLS decide o acesso.

## Backup

- planos Pro/Team/Enterprise têm backups automáticos conforme o plano;
- mantenha também uma exportação lógica externa com `supabase db dump`;
- objetos do Storage exigem rotina própria, pois backup do banco guarda apenas
  seus metadados;
- restaure periodicamente em outro projeto/banco e compare com
  `scripts/backup-verify.ts`; nunca rode testes destrutivos na restauração.

