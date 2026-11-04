# Especificação 011 — API TypeScript e banco Supabase

**Status:** aprovada para implementação em 03/10/2026.

## Objetivo

Substituir a API Java ainda não integrada por uma API TypeScript que persista o
núcleo confirmado da spec 008 no PostgreSQL do Supabase. O banco deve usar o
Supabase Auth para identidade e Row Level Security (RLS) para isolar cada
cooperativa.

## Escopo

- autenticar access tokens emitidos pelo Supabase;
- manter usuários, papéis e cooperativas sem senha própria na aplicação;
- cadastrar produtos, escolas, produtores e motivos;
- permitir ciclos em planejamento enquanto outro está aberto;
- registrar pedido da escola, recebimento no galpão, entrega inicial,
  complemento e decisão de falta;
- preservar idempotência, versão otimista e auditoria;
- calcular pagamento pelo aceito no galpão e cobrança pelo aceito na escola;
- fechar o ciclo somente quando as regras da spec 008 estiverem satisfeitas;
- entregar migrações versionadas no padrão da CLI do Supabase.

## Regras

- **RN-011.1 Identidade:** senhas e sessões pertencem ao Supabase Auth. A API
  não armazena hash de senha nem emite JWT próprio.
- **RN-011.2 Multiempresa:** toda linha operacional contém
  `organization_id`; RLS confirma a associação ativa do usuário.
- **RN-011.3 Papéis:** `ADMIN` gerencia membros e tudo da operação;
  `OPERADOR` altera cadastros e operação; `CONSULTA` só lê.
- **RN-011.4 Banco como última barreira:** tabelas expostas têm RLS, permissões
  mínimas e nenhuma política para `anon`.
- **RN-011.5 Contexto do usuário:** a API consulta o Supabase usando o token do
  usuário, para que as políticas RLS também sejam aplicadas às chamadas do
  backend. A chave `service_role` não participa do fluxo normal.
- **RN-011.6 Ciclos:** pode existir um ciclo `ABERTO` e vários
  `PLANEJAMENTO`; um ciclo fechado é imutável.
- **RN-011.7 Metodologia:** ciclos novos usam `ACEITE_ESCOLAR`; dados antigos
  podem permanecer em `LEGADO_PEDIDO_MENOS_DEVOLUCAO` e nunca são
  recalculados silenciosamente.
- **RN-011.8 Quantidades:** banco e API preservam `null` como não conferido e
  `0` como conferido com zero.
- **RN-011.9 Dinheiro:** cada linha é arredondada a centavos; o total soma as
  linhas arredondadas.
- **RN-011.10 Concorrência:** comandos usam `expectedVersion` e
  `idempotencyKey`; evento e auditoria são gravados atomicamente por função
  SQL.
- **RN-011.11 Histórico:** preço e desconto de logística são congelados no
  lançamento e não são sobrescritos por correção.
- **RN-011.12 Backup:** PDFs não são backup. Produção deve ter backup do plano
  Supabase e exportação lógica externa periódica, com ensaio de restauração.

As RN-01 a RN-22 da spec 008 continuam sendo a fonte de verdade do ciclo.

## Critérios de aceite

- **CA-011.1** Token ausente, inválido ou expirado recebe `401`; usuário sem
  associação recebe `403`.
- **CA-011.2** Um membro da organização A não lê nem altera linhas da B, mesmo
  chamando o Supabase diretamente com seu token.
- **CA-011.3** CONSULTA não altera dados; OPERADOR não gerencia membros.
- **CA-011.4** É possível criar produto, escola e produtor pela API.
- **CA-011.5** O exemplo 200/180/170 resulta em pagar 180, cobrar 170, falta
  30 e perda da cooperativa 10.
- **CA-011.6** Complemento de 30 em outra viagem atende 200 sem cobrança
  duplicada; complemento na mesma viagem não soma novamente.
- **CA-011.7** Reenvio com a mesma chave e mesmo conteúdo não duplica; mesma
  chave com outro conteúdo falha.
- **CA-011.8** Correção com versão antiga falha e não deixa gravação parcial.
- **CA-011.9** Um ciclo fechado rejeita toda mutação operacional.
- **CA-011.10** A migração pode ser aplicada por `supabase db reset` e enviada
  por `supabase db push` sem edição manual no painel.

## Fora deste incremento

- trocar todas as telas atuais do Prisma para a API;
- migrar automaticamente o banco SQLite/Prisma atual;
- criar o projeto remoto do Supabase sem as credenciais do proprietário;
- guardar arquivos assinados no Supabase Storage.

