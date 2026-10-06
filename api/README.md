# Colheita API TypeScript

API REST do ciclo PNAE, separada do frontend e preparada para PostgreSQL,
Supabase Auth e Row Level Security.

## Executar

1. Aplique as migrações de `../supabase` numa instância local ou remota.
2. Copie `.env.example` para `.env` e preencha URL e chave publicável.
3. Instale e execute:

```powershell
npm install
npm run dev
```

Saúde: `GET http://127.0.0.1:8080/health`.

Rotas protegidas recebem `Authorization: Bearer <access_token>`. Recursos da
cooperativa usam `/api/v1/organizations/:organizationId/...`; a API confirma
o vínculo e o banco repete a autorização via RLS.

## Módulos disponíveis

- identidade e cooperativas acessíveis (`/me`);
- membros e papéis `ADMIN`, `OPERADOR` e `CONSULTA`;
- produtos, escolas, produtores e motivos de devolução;
- preços com vigência e mapa mensal de produção;
- ciclos semanais em planejamento, abertos e fechados;
- pedidos por escola e divisão dos pedidos entre produtores;
- recebimento no galpão, rejeições, complementos e decisões de falta;
- custos, fechamento financeiro e trilha de auditoria.

O contrato HTTP completo está em `docs/openapi.yaml`. O contrato não cria
usuários do Auth: primeiro o usuário é convidado no Supabase e depois um
ADMIN associa seu UUID à cooperativa.

## Verificação

```powershell
npm run typecheck
npm test
npm run build
```

Não há email ou senha padrão. Usuários pertencem ao Supabase Auth e o primeiro
ADMIN é associado conforme `../supabase/README.md`.

