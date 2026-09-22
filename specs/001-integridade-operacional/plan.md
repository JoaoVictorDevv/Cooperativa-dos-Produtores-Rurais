# Plano técnico — Especificação 001

## Estratégia

- Centralizar regras puras de datas e fechamento em `src/lib/weekPolicy.ts`.
- Cobrir essas regras com testes unitários independentes do banco.
- Adicionar restrições únicas no Prisma e no PostgreSQL.
- Usar índice parcial no PostgreSQL para garantir uma única semana `ABERTA`.
- Tornar `writeAudit` compatível com o cliente transacional do Prisma.
- Executar cada mutação crítica e sua auditoria na mesma transação.
- Corrigir o acumulado PNAE para buscar devoluções pelas semanas das entregas.
- Endurecer o seed sem expor senha em logs.

## Migração de dados

A migração consolida eventuais devoluções duplicadas antes de criar os índices únicos:

- mantém o registro atualizado mais recentemente;
- soma as quantidades duplicadas nesse registro;
- remove somente as duplicatas já incorporadas.

Se já houver mais de uma semana aberta, a migração deve falhar de modo explícito para exigir decisão humana; não é seguro escolher automaticamente qual semana fechar.

## Verificação

- testes unitários das políticas;
- testes existentes de cálculos;
- validação do schema Prisma;
- lint;
- build de produção;
- testes de integração somente quando um `DATABASE_URL` de teste isolado estiver configurado.

