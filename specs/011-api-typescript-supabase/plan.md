# Plano técnico — API TypeScript e Supabase

## Decisões

- Node.js 22+ e TypeScript estrito.
- Fastify para HTTP, Zod para contratos e `@supabase/supabase-js` para o Data
  API com o token do usuário.
- `jose` valida JWT assimétrico pelo JWKS do projeto antes de aceitar a
  requisição. Projetos ainda configurados com segredo HS256 usam
  `supabase.auth.getUser` como modo compatível.
- Arquitetura em `domain`, `application`, `infrastructure` e `interfaces`.
- Funções SQL transacionais implementam os comandos que exigem trava,
  idempotência e auditoria.

## Entregas

1. registrar esta especificação e a revisão da implementação anterior;
2. substituir o projeto Maven pelo projeto TypeScript;
3. criar a migração inicial em `supabase/migrations` com RLS;
4. implementar autenticação, autorização, catálogos, ciclos e núcleo da
   spec 008;
5. testar regras puras e contratos HTTP sem acessar dados reais;
6. documentar configuração, deploy, backup e a transição do frontend.

## Migração do sistema em uso

O frontend continua no Prisma até existir um adaptador de API e uma migração
de dados conferida. A troca será feita por ciclo: não haverá escrita simultânea
do mesmo ciclo nos dois bancos.

