# Arquitetura da API

```text
interfaces/http -> application/services -> application/ports <- infrastructure
                           |                                      |
                           v                                      v
                         domain                       Supabase Auth + PostgreSQL
```

- `domain`: regras e tipos puros, sem Fastify ou Supabase;
- `application/ports`: contratos para autenticação e persistência;
- `application/services`: casos de uso e autorização por papel;
- `infrastructure/security`: valida JWT do Supabase por JWKS ou Auth server;
- `infrastructure/persistence`: Data API com o token do usuário;
- `interfaces/http`: validação Zod, rotas Fastify e erros RFC 9457.

## Segurança em profundidade

1. a API valida o access token;
2. confirma que o usuário é membro ativo da organização;
3. o serviço confere o papel;
4. o cliente Supabase encaminha o mesmo token;
5. grants e RLS repetem a autorização no PostgreSQL;
6. constraints e triggers protegem integridade, ciclo fechado e auditoria.

A `service_role` não é usada no fluxo normal. Isso evita que um erro de filtro
na API ignore o isolamento entre cooperativas.

## Operações atômicas

Comandos de entrega, complemento, decisão de falta e fechamento são funções
SQL `security invoker`. Elas executam no contexto do usuário e usam locks,
chaves de idempotência e versões para manter evento e auditoria consistentes.

