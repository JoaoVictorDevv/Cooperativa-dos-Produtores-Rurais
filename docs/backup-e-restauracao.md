# Backup e restauração — roteiro e verificação

**Situação (27/09/2026):** ferramenta de verificação e ensaio automatizado
**prontos e testados em bancos descartáveis**. A **infraestrutura** de backup
em produção (agendamento, armazenamento, criptografia, retenção, credenciais)
e o **ensaio real de restauração** continuam com o **Lucas** — nada aqui foi
executado contra o banco real.

## O que precisa ser recuperável

O banco inteiro, não só telas ou PDFs (**PDF não é backup**): ciclos e datas,
reaberturas, pedidos das escolas, divisão e pedidos aos produtores,
recebimentos e rejeições no galpão, devoluções/entregas nas escolas (e, quando
existirem, eventos de entrega por escola/produto, complementos e decisões de
falta), preços e descontos históricos (`priceId`, `logisticsDeductionSnapshot`),
custos, usuários e auditoria, e o histórico de migrações (`_prisma_migrations`).
O banco novo do Lucas (`database/`) precisa do mesmo cuidado quando entrar em uso.

## Roteiro

1. **Antes do dump — impressão digital da origem (só leitura):**
   ```bash
   VERIFY_DATABASE_URL="postgresql://…/origem" npx tsx scripts/backup-verify.ts --salvar origem.json
   ```
   Guarda, por tabela, o número de linhas e um hash do conteúdo; checagens de
   integridade; e os totais de cada ciclo (a cobrar, a pagar, custos,
   resultado). Não guarda dados pessoais nem a URL.
2. **Dump** (formato custom, sem dono):
   `pg_dump --format=custom --no-owner --file backup.dump --dbname=<origem>`.
   Guardar `backup.dump` **junto com** `origem.json`.
3. **Restaurar sempre num banco NOVO**, nunca por cima da origem:
   `createdb colheita_restauracao_<data>` e
   `pg_restore --no-owner --no-privileges --dbname=<novo> backup.dump`.
4. **Verificar a cópia (só leitura):**
   ```bash
   VERIFY_DATABASE_URL="postgresql://…/novo" npx tsx scripts/backup-verify.ts --comparar origem.json
   ```
   Saída 0 = **idêntica** (tabelas, linhas, conteúdo, integridade e totais de
   cada ciclo); 1 = lista exatamente o que difere.
5. **Nunca** rodar `npm run test:integration` (nem outro teste) apontando para
   a cópia restaurada ou para a origem: a suíte **apaga** dados. Ela só roda
   em banco descartável criado por ela mesma.

Os dois scripts abrem a conexão com `default_transaction_read_only=on` e
conferem isso no servidor antes de ler; qualquer tentativa de escrita é
recusada pelo próprio Postgres.

## Ensaio automatizado (feito)

`src/lib/backup/backupDrill.integration.test.ts`, via `npm run test:integration`
(bancos descartáveis com nome e marca da execução; a cópia é apagada no fim):

- ciclo fechado (pedido, devolução, galpão, custo) + ciclo aberto + usuário e
  auditoria → impressão digital → `pg_dump` → banco novo → `pg_restore` →
  comparação: **idêntica**;
- a cópia mantém a proteção do ciclo fechado (os gatilhos do banco recusam
  alterar o custo);
- uma alteração proposital na cópia (pedido do ciclo aberto) é **detectada**:
  tabela `school_orders` com conteúdo diferente e total a cobrar
  621,35 × 635,97;
- a conexão de verificação não consegue gravar.

## Para o Lucas

- Agendar o dump (sugestão: diário, e um extra logo após cada fechamento de
  ciclo), armazenar fora do servidor do banco, criptografado, com retenção
  definida (sugestão: 30 diários + 12 mensais) e acesso restrito.
- Guardar a impressão digital (`--salvar`) de cada dump.
- Ensaio real de restauração periódico (sugestão: mensal) num banco novo,
  verificado com `--comparar`, com registro de data, tamanho e resultado.
- Fazer o mesmo para o banco novo (`database/`) quando ele entrar em uso; o
  `fingerprint.ts` lê qualquer esquema `public`, mas os totais por ciclo usam
  as tabelas do app atual.
