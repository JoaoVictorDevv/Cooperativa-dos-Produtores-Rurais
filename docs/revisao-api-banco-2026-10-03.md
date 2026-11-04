# Revisão técnica da API e do banco — 03/10/2026

## Estado encontrado

- A pasta estava na branch `claude/pnae-excel-structure-djoy3c`, 40 commits
  atrás de `origin/develop`. O trabalho passou para
  `codex/typescript-supabase-api`, baseada na `develop` atual.
- O frontend Next/Prisma está funcional no modelo antigo. O domínio da spec
  008, a importação, PDFs e casos de aceitação já existem e não devem ser
  reescritos.
- A API Java e as migrações SQL nunca foram integradas ao frontend nem ao
  banco usado pelo app.
- O SQL antigo cria usuários, senhas, refresh tokens e roles próprios. Isso
  duplica o Supabase Auth e não possui RLS.
- O banco antigo não registra entrega escolar por produto, complemento,
  viagem, perda pré-escola ou decisão de falta. Portanto não consegue cumprir
  a spec 008.
- A view financeira antiga cobra `pedido - devolução`, regra substituída para
  ciclos novos pelo aceite real na escola.
- A restrição de uma única semana aberta não permitia preparar o próximo
  pedido. O novo modelo separa `PLANEJAMENTO` de `ABERTO`.

## Direção adotada

TypeScript é a opção de menor risco neste repositório: os contratos executáveis
e os 17 cenários de aceitação já são TypeScript/JSON, e a equipe mantém uma só
cadeia de ferramentas. Supabase assume identidade; PostgreSQL assume
integridade e RLS; a API concentra casos de uso e contrato HTTP.

## Limite desta entrega

A API e o banco novo são a fundação definitiva, mas o frontend só deve deixar
o Prisma depois que o adaptador, a migração histórica e o ensaio de restauração
forem concluídos. Até lá, não apontar as telas atuais diretamente para o banco
Supabase.

