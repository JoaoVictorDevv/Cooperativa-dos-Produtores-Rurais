# Colheita — estado atual

## Rodada 2 (vigente desde 24/09/2026): operação real, specs, develop

**Comece por aqui:** `docs/relatorio-sessao.md` (ponto de entrada e
retomada), `docs/plano-de-implementacao.md` (lista única de etapas R2-0…R2-9
com estado), `specs/README.md` (regras de produto) e o prompt integral em
`docs/prompts/2026-09-24-prompt-v2-operacao-specs-develop.md`.

- Branch de trabalho: `feat/relatorios-diferencas-importacao`. Integração e
  push na `develop` autorizados pelo Lucas após validação. `main`/`staging`
  intocáveis; sem force push; sem produção.
- A Rodada 1 inteira já estava na develop (merge `2997ac2`, feito pelo João
  Victor em 25/09, junto com o commit `3e77064` do Lucas: API Java em
  `api/` + PostgreSQL em `database/`). A branch de trabalho foi avançada por
  fast-forward até `2997ac2`.
- **Arquitetura em transição**: as telas Next.js usam Prisma direto; a API
  Java do Lucas usa outro banco (schema `colheita`, UUID, `organization_id`)
  e não está ligada às telas. Não migrar sem contrato combinado — o contrato
  proposto fica em `docs/propostas-pendentes.md`.
- **Regras de negócio confirmadas** (substituem hipóteses antigas): produtor
  recebe pelo aceito no galpão; prefeitura paga pelo aceito na escola;
  rejeição na escola é perda da cooperativa; faltas se resolvem no mesmo
  ciclo (complemento) ou são encerradas sem atendimento — nunca carregadas
  para a semana seguinte. Detalhes e exemplos: `specs/008-…/spec.md`.
- Progresso detalhado, evidências e próximo passo: seção "Rodada 2" do
  `docs/relatorio-sessao.md`. Rodada 2 integrada na develop no merge
  `fce91a3` (26/09/2026). Próxima etapa independente sugerida: gerar pedidos
  aos produtores a partir da divisão (propostas §6).

---

## Rodada 1 (histórico): relatórios, diferenças e importação
**Branch de trabalho:** `feat/relatorios-diferencas-importacao` (criada a
partir da `develop` no commit `6d632cb`, que já inclui o trabalho do
olucasgon e os 5 ajustes pequenos do modelo — preservar, não reverter).

**Plano completo desta sessão:** `docs/plano-de-implementacao.md` (contém o
prompt integral recebido e a quebra em etapas por dependência). Este
memory.md registra o progresso real etapa por etapa — ver seção
"Progresso da sessão atual" mais abaixo, que é atualizada a cada etapa
concluída. **Ao final da sessão** (todas as 6 etapas), ver também
`docs/relatorio-sessao.md` (relatório completo em português simples,
como pedido) e `docs/propostas-pendentes.md` (as 6 propostas da Etapa 6
que dependem de decisão do usuário e/ou do olucasgon).

Restrições ativas nesta sessão (ver plano para detalhes): não mexer em
schema/migrações/seed/credenciais de banco (área do olucasgon), não rodar
operação destrutiva em banco sem proteção de ambiente de teste comprovado,
não integrar na `develop`, não tocar `main`/`staging`, sem deploy, sem
force push. Uma etapa por vez, commit+push a cada etapa concluída.

### Progresso da sessão atual (atualizar a cada etapa concluída)

- [FEITO] Setup: branch criada, `docs/plano-de-implementacao.md` escrito e
  commitado, `memory.md` atualizado com o nome da branch — tudo isso ANTES
  de começar qualquer implementação, conforme pedido. Commit `0b93288`.
- [FEITO] Etapa 1 — Correções de consistência e salvamento (prompt §4, §5,
  §6). Commit `909ab99`. Detalhes na subseção "Etapa 1" abaixo.
- [FEITO] Etapa 2 — Painel Diferença do galpão (§7). Commit `4efffd5`.
  Detalhes na subseção "Etapa 2" abaixo.
- [FEITO] Etapa 3a — Escolas/Produtores (lista e ficha) navegáveis por
  semana histórica via `?week=` (pré-requisito de §10 e §12). Detalhes na
  subseção "Etapa 3a" abaixo. Falta ainda 3b (PDFs, §12).
- [FEITO] Etapa 3b — Geração de PDFs por semana (§12). Detalhes na
  subseção "Etapa 3b" abaixo.
- [FEITO] Etapa 4 — Melhorias de navegação (decorrente da 3). Link "Ver
  semana completa" adicionado em Escolas, Produtores, Resumo, Balanço e
  Diferença, apontando pro hub `/semanas/[weekId]` — antes dessas 5 telas
  não tinham nenhum caminho de volta pro hub além do botão "voltar" do
  navegador. Validado: tsc/eslint/29 testes/build limpos + teste de
  interface confirmando o link nas 5 páginas.
- [PARCIAL] Etapa 5 — Importação **Excel** funcional e completa (§13):
  ler → conferir → resolver pendências → confirmar → gravar, tudo de
  verdade, não é só um leitor. Importação por **PDF ainda não foi feita**
  (ver justificativa na subseção "Etapa 5" abaixo — não é meia-solução
  apresentada como pronta, é trabalho não iniciado, registrado como tal).
  Ainda depende do exemplo real da prefeitura pra validação final do
  formato — desenvolvido e testado com dados fictícios/sintéticos
  enquanto isso, exatamente como o plano pede.
- [FEITO] Etapa 6 — Documentação de propostas que exigem banco/decisão
  operacional (§8, §9, §14, §15, §16, §17). Tudo em
  `docs/propostas-pendentes.md` — entrega efetiva por escola, cobrança
  com faltas, semanas futuras, retirada de Ovos (código já preparado na
  Etapa 5, só falta o UPDATE de dado real coordenado com o olucasgon),
  backup, e divisão→pedido sem redigitar. Nenhuma mudança de schema ou
  infraestrutura foi feita — só análise e proposta, como pedido. Ver
  também o relatório final `docs/relatorio-sessao.md`.

#### Etapa 1 — detalhes (concluída)

**O que foi corrigido** (ver `docs/plano-de-implementacao.md` §4/§5/§6 pro
texto original do pedido):

1. **§4A — reduzir pedido/entrega abaixo de uma devolução já registrada
   agora é bloqueado**, nos dois lados:
   - `src/app/actions/producerDeliveries.ts`: reduzir a entrega do produtor
     pra menos que a devolução já lançada é recusado com mensagem
     explicando que a devolução precisa ser corrigida antes.
   - `src/app/actions/schoolOrders.ts`: mesma regra pro pedido da escola
     vs. a devolução da escola.
   - A checagem roda DENTRO da mesma transação que grava (reduz — não
     elimina — a janela de corrida em edições simultâneas; uma proteção
     100% à prova de concorrência exigiria uma constraint no banco, fica
     documentado como pendência pro olucasgon, não implementado aqui).
2. **§4B — correção para zero, distinta de "não conferido"**:
   - Bug real encontrado: `ReturnRow.tsx` (ficha da escola) e
     `ProducerProductRow.tsx` (produtores) tinham um `if (numeric === 0)
     return` que IMPEDIA salvar zero — ou seja, uma devolução lançada por
     engano não podia ser corrigida pra zero pela interface (o clique não
     fazia nada). Corrigido: agora, se já existe uma devolução gravada,
     corrigir pra zero é permitido e **remove o lançamento** (não grava uma
     linha de devolução com quantidade zero, já que motivo é obrigatório
     nesse modelo — zero devolução = ausência do registro). Sem devolução
     existente, campo em branco continua sendo no-op (nada digitado, nada
     a salvar).
   - `src/app/actions/schoolReturns.ts` e `producerReturns.ts`: quando a
     quantidade enviada é zero, a action agora apaga o registro existente
     (se houver) em vez de tentar validar motivo — motivo só é exigido
     quando a quantidade é maior que zero.
   - Bug real encontrado (entrega do produtor): `ProducerProductRow.tsx`
     tratava campo vazio ("") e "0" digitado como a MESMA coisa
     (`num(nextDelivered) === 0` bloqueava os dois), então uma entrega
     ZERO CONFIRMADA (ex.: produtor não entregou nada essa semana) não
     dava pra salvar — e o estado inicial também colapsava
     `deliveredQty=0` salvo no banco pra campo em branco na tela (mesmo
     bug, no lado da leitura). Corrigido: branco = não conferido (não
     salva), "0" explícito com data = zero confirmado (salva e persiste
     como "0", não como campo vazio).
3. **§4C — feedback de salvando/salvo/erro**: adicionado indicador
   "salvando…"/"salvo" (reaproveitando o padrão visual que já existia em
   `SchoolOrderCell.tsx`) em `ReturnRow.tsx` e em todos os quatro campos de
   `ProducerProductRow.tsx` (divisão, pedido, entrega, devolução).
4. **§5 — preço e desconto de logística não são mais re-resolvidos numa
   correção**: bug real encontrado em `producerDeliveries.ts` — toda vez
   que uma entrega já existente era corrigida (ex.: ajustar só a
   quantidade), o código buscava o desconto de logística ATUAL em
   `Settings` e sobrescrevia o valor congelado do lançamento original,
   contrariando o próprio comentário do schema ("congela o pagamento
   histórico mesmo que preço/dedução mudem depois"). Corrigido: preço e
   desconto só são gravados na CRIAÇÃO; uma correção de quantidade/data
   não altera mais esses valores. Mesmo tratamento aplicado por
   consistência em `schoolOrders.ts` e `producerOrders.ts` (preço).
5. **§6 — proteção de banco de teste**: `src/lib/pnae.integration.test.ts`
   agora recusa rodar (lança erro antes de apagar qualquer tabela) se
   `DATABASE_URL` não apontar pra um banco cujo nome contenha "test". Só
   corrigido no código do teste — nenhuma credencial/infra alterada.

**Arquivos alterados** (todos fora de schema/migração/seed/credenciais):
`src/app/actions/producerDeliveries.ts`, `producerOrders.ts`,
`producerReturns.ts`, `schoolOrders.ts`, `schoolReturns.ts`,
`src/app/(app)/escolas/[code]/ReturnRow.tsx`,
`src/app/(app)/produtores/ProducerProductRow.tsx`,
`src/lib/pnae.integration.test.ts`.

**Atenção pro olucasgon**: os 5 arquivos em `src/app/actions/` acima
mudam funções de gravação (upserts/deletes) — destacando aqui conforme
pedido, pra revisão dele antes de considerar isso definitivo.

**Testes executados** (tipos diferenciados conforme pedido):
- Código inspecionado: todos os arquivos acima, lidos por completo antes
  de editar.
- Teste automatizado executado: `npx tsc --noEmit` (limpo, só o erro
  conhecido/inofensivo de `LayoutProps`), `npx eslint` (limpo), `npm run
  test` — 24 testes unitários passando, `npm run build` (build de
  produção OK).
- Teste com banco: `npm run test:integration` — 5 testes contra
  `colheita_test`, todos passando, agora com a proteção do §6 ativa (o
  DATABASE_URL do `.env.test` foi confirmado como um banco com "test" no
  nome antes de rodar).
- Teste de interface (Playwright, contra `colheita` local com dados
  fictícios/de teste — produtor P02 e escola 3007, sem tocar dados
  "reais" da semana 1 usados antes): 12 cenários, todos passando —
  redução de entrega/pedido abaixo da devolução bloqueada (produtor e
  escola), devolução corrigida pra zero remove o lançamento (produtor e
  escola) e persiste removida após reload, entrega "0" confirmada persiste
  como "0" (não vira branco) após reload, e — o mais delicado — corrigir
  a quantidade de uma entrega depois de mudar
  `Settings.logisticsDeductionPerKg` globalmente NÃO alterou o
  `logisticsDeductionSnapshot` já gravado (confirmado direto no banco via
  SQL). A configuração global foi revertida ao valor original (3.67) ao
  final do teste.
- Cenário ainda não validado: comportamento sob concorrência real (duas
  edições simultâneas de fato disparadas ao mesmo tempo) — a checagem foi
  movida pra dentro da transação como mitigação, mas não foi testada sob
  carga concorrente real; ver nota de pendência de banco abaixo.

**Pendência de banco documentada pro olucasgon**: uma proteção 100% à
prova de concorrência para "não reduzir abaixo da devolução" exigiria uma
constraint/trigger no banco (ex.: CHECK entre tabelas via função, ou uma
coluna de versão pra lock otimista) — não implementado nesta etapa por
exigir schema/migração, que é área dele. A mitigação atual (checagem
dentro da mesma transação da escrita) cobre o caso comum de uso sequencial
por um operador só.

**Não implementado nesta etapa** (fora do escopo do §4/§5/§6, não
confundir com pronto): tela de auditoria nova (não pedido — auditoria já
existente via `AuditLog` foi usada, não alterada), qualquer mudança em
`SchoolOrderCell.tsx` (pedido da escola tem a mesma ambiguidade
zero-vs-branco na leitura inicial, mas como não há um passo de
"conferência" separado pra pedido de escola — diferente de entrega de
produtor — isso não bloqueia nenhum fluxo real; registrado aqui como
inspecionado, não corrigido, caso vire prioridade depois).

#### Etapa 2 — detalhes (concluída)

**O que foi implementado** (`docs/plano-de-implementacao.md` §7): tela nova
"Diferença do galpão" (`/diferenca`), por produto e semana:

- Pedido total das escolas, entrega bruta dos produtores, devolução aos
  produtores, entrega líquida (bruta − devolução) e diferença (líquida −
  pedido), cada um na unidade certa do produto (kg ou dz — reaproveita
  `formatQty` do ajuste anterior).
- Status por produto: `FALTA` (líquida < pedido, badge vermelho),
  `SOBRA` (líquida > pedido, badge amarelo), `OK` (iguais, badge verde) —
  reaproveita as classes `.badge.estourado/.atencao/.ok` que já existiam
  pro alerta PNAE removido na sessão anterior.
- Funciona pra semana aberta (usa a semana aberta atual por padrão) e
  fechada (aceita `?week=<id>`, mesmo padrão de Resumo/Balanço) — o código
  não tem nenhum branch por `week.status`, então não há caminho que exclua
  semana fechada.
- Filtro por status (Todos/Falta/Sobra/OK) client-side, com contagem.
- Acesso aos detalhes: link "Diferença" adicionado na tela de Histórico
  (ao lado de Resumo/Balanço) pra cada semana passada, e atalho no painel.
- **Não** mistura com estoque do galpão nem atendimento por escola — texto
  explicativo fixo no rodapé da tabela avisando isso, e nenhuma soma cruza
  produtos de unidades diferentes (a tabela é sempre por produto; não há
  linha de "total geral em kg").

**Arquivos novos:** `src/app/(app)/diferenca/page.tsx`,
`src/app/(app)/diferenca/DiferencaTable.tsx`.
**Arquivos alterados:** `src/lib/calc.ts` (funções puras
`netProducerDelivered`, `warehouseDifference`, `differenceStatus`),
`src/lib/weekSummary.ts` (`getWarehouseDifferenceLines`),
`src/components/nav-items.ts` (item de menu), `src/app/globals.css`
(`.filter-chip.active`, que também corrigiu de graça um estado "ativo"
sem estilo que já existia na tela de Histórico), `src/app/(app)/historico/page.tsx`
e `src/app/(app)/painel/page.tsx` (links de acesso).

**Testes executados:**
- Automatizado: 5 novos testes unitários em `calc.test.ts` cobrindo
  FALTA/SOBRA/OK e o efeito da devolução na entrega líquida — `npm run
  test` (29 testes, todos passando), `tsc --noEmit` limpo, `eslint`
  limpo, `npm run build` OK.
- Interface (Playwright, dados fictícios já usados na Etapa 1): tela
  carrega, números batem com o esperado calculado à mão a partir do
  banco (Abacate 150kg pedido / 0 entregue → FALTA -150; Alface lisa 45kg
  entregue sem pedido → SOBRA +45; Chuchu 30 pedido / 25 líquida → FALTA
  -5), filtros Todos/Falta/Sobra/OK funcionam e contam certo.
- **Atualização (Etapa 3a):** o cenário de semana FECHADA de verdade foi
  testado depois — ver subseção "Etapa 3a" abaixo. Confirmado igual ao
  esperado.

#### Etapa 3a — detalhes (concluída)

**Problema encontrado:** nenhuma das telas operacionais (`/escolas`,
`/escolas/[code]`, `/produtores`, `/produtores/[internalId]`) aceitava
`?week=` — todas usavam `getOpenWeek()` direto, então não tinha como ver
o pedido/entrega/devolução de uma semana já FECHADA por essas telas (só
Resumo, Balanço e a Diferença nova tinham esse suporte). Isso bloqueava o
§10 (histórico completo) inteiro, e também o §12 (PDF precisa poder gerar
pra qualquer semana, não só a aberta).

**O que foi corrigido:**
- `escolas/page.tsx`, `produtores/page.tsx`: aceitam `?week=<id>`, caem em
  `getOpenWeek()` sem o parâmetro (comportamento de sempre preservado).
- `escolas/[code]/page.tsx`, `produtores/[internalId]/page.tsx`: mesma
  coisa pras fichas individuais; link "Voltar" preserva o `?week=`.
- `EscolasTable.tsx` e `ProducerRow.tsx`: o link "Ficha" de cada linha
  agora inclui `?week=${weekId}`, pra continuar na mesma semana ao abrir
  o detalhe.
- Como o campo `editable` dessas páginas já era calculado a partir de
  `week.status === "ABERTA"`, bastou trocar QUAL semana é carregada — os
  inputs já ficam desabilitados automaticamente numa semana fechada, sem
  nenhuma mudança adicional de lógica.
- `semanas/[weekId]/page.tsx` virou de fato o "hub" central por semana
  pedido pelo §10: os atalhos pra Escolas/Produtores/Diferença/Resumo/
  Balanço agora SEMPRE aparecem (antes Escolas/Produtores só apareciam se
  a semana estivesse aberta) e todos apontam pra `?week=${week.id}`; e
  ganhou um mini-resumo da Diferença do galpão (contagem de produtos em
  FALTA/SOBRA/OK) e um aviso de produtores pendentes, sem duplicar
  nenhuma tabela — só reaproveita `getWarehouseDifferenceLines` e
  `getPendingProducerDeliveries`, que já existiam.

**Arquivos alterados:** `src/app/(app)/escolas/page.tsx`,
`escolas/EscolasTable.tsx`, `escolas/[code]/page.tsx`,
`produtores/page.tsx`, `produtores/ProducerRow.tsx`,
`produtores/[internalId]/page.tsx`, `semanas/[weekId]/page.tsx`.

**Testes executados:**
- Automatizado: `tsc --noEmit` limpo, `eslint` limpo, `npm run test` (29
  testes, nenhuma mudança de lógica de cálculo nesta etapa), `npm run
  build` OK.
- Interface (Playwright, dados fictícios): fechei de verdade a "Semana 1"
  de teste (confirmei entrega física — dia/data — das 3 escolas com
  pedido, que é exigência do olucasgon pra fechar, `weekPolicy.ts`, e
  isso NÃO envolveu mexer em schema/regra nenhuma, só usar o formulário
  de confirmação de entrega que já existia) e então, com a semana já
  FECHADA de verdade:
  - `/escolas?week=` e `/produtores?week=` mostram o badge FECHADA e os
    campos ficam desabilitados (confirmado via `isDisabled()`);
  - a ficha de uma escola e de um produtor abrem corretamente pra essa
    semana fechada, preservando `?week=` inclusive no link "Voltar";
  - `/diferenca?week=` também funciona igual pra semana fechada (resolve
    a pendência de teste que tinha ficado da Etapa 2);
  - o hub `/semanas/[weekId]` mostra o resumo de Diferença, os links
    corretos, e o formulário de reabertura (só ADMIN).
  - Uma repetição do fluxo de clique na "Ficha" mostrou uma falha
    intermitente (URL não mudou) que NÃO se repetiu em duas reproduções
    isoladas subsequentes — atribuído a tempo de compilação do `next dev`
    (Turbopack compilando a rota pela primeira vez), não a um bug da
    aplicação; registrado aqui por transparência, não escondido.
- Não deixei a semana de teste reaberta de propósito — ela serve agora
  como a primeira semana FECHADA de verdade no banco de dev, útil pros
  próximos testes (PDF, etc.).

#### Etapa 3b — detalhes (concluída)

**O que foi implementado** (`docs/plano-de-implementacao.md` §12): geração
real de PDF (não é impressão do navegador) para os 7 documentos pedidos,
por semana selecionada, mais um pacote ZIP com todos juntos.

- Biblioteca escolhida: `@react-pdf/renderer` (gera PDF em Node puro, sem
  precisar de navegador/Chromium em produção — importante pra um deploy
  futuro em ambiente serverless tipo Vercel) + `jszip` pro pacote. Duas
  dependências novas em `package.json`, nada de infraestrutura de banco.
- `src/lib/pdf/`: `styles.ts` (estilos/formatação compartilhados, aviso
  padrão de "semana ainda aberta", disclaimer sobre cadastro sem
  histórico), `SimpleReport.tsx` (documento tabular genérico), 
  `SchoolRomaneiosDocument.tsx` (um romaneio por página, por escola),
  `BalanceReportDocument.tsx` (balanço com 3 seções), `definitions.ts`
  (lista dos 7 relatórios, leve, sem depender do react-pdf) e
  `reports.tsx` (busca os dados de cada relatório — reaproveitando
  `getWeekFinancialSummary`, `getWarehouseDifferenceLines`,
  `getProducerPaymentLines` já existentes, e consultas novas simples pra
  pedido de escola/produtor e entregas de escola).
- Os 7 documentos: Pedido das Escolas, Pedidos aos Produtores, Romaneios
  das Escolas (um por escola com pedido, cada um sua própria página —
  não funde escolas de endereço compartilhado, cada código é um
  documento), Recebimento e Devoluções no Galpão, Entregas às Escolas
  (só o dia confirmado — deixa explícito que quantidade por produto
  entregue à escola ainda não existe no sistema, ver §8), Relatório de
  Diferenças (mesma tela/regra da Etapa 2), Balanço Financeiro.
- Rotas: `GET /api/semanas/[weekId]/pdf/[report]` (um arquivo) e
  `GET /api/semanas/[weekId]/pdf/zip` (pacote com os 7). Protegidas pelo
  `proxy.ts` (que já bloqueia `/api/*` sem cookie de sessão) e por
  `verifySession()` dentro do handler — mesma permissão pra arquivo
  individual e pro zip, sem distinção (leitura, igual olhar a tela).
- UI: seção "Documentos da semana" no hub `/semanas/[weekId]` (a mesma
  tela que virou central na Etapa 3a), com os 7 botões de download mais
  "Baixar tudo (.zip)".
- Cada documento identifica a semana, a data/hora de emissão, e mostra um
  aviso vermelho se a semana ainda estiver ABERTA ("os valores podem
  mudar até o fechamento"). Funciona pra semana aberta ou fechada (usa a
  mesma função `getWeekMeta` isolada de `getOpenWeek()`).

**Limitação documentada, não resolvida (fora do escopo desta sessão):**
nome/endereço/telefone de escola e produtor NÃO têm histórico próprio no
banco (só quantidades e preços são congelados por semana) — se alguém
editar o cadastro de uma escola hoje, um romaneio de uma semana antiga
regenerado vai mostrar o endereço ATUAL, não o que valia na época. Isso
está escrito em texto pequeno no rodapé de cada documento
(`CADASTRO_DISCLAIMER`). Resolver de verdade exigiria histórico
versionado de `School`/`Producer` no schema — decisão do olucasgon, não
implementada aqui.

**Também não implementado (consciente, fora do §12 estrito):** não existe
armazenamento do PDF gerado nem do "arquivo original" de nada — cada
download é gerado na hora, a partir dos dados atuais do banco. Isso
significa que dois downloads do mesmo relatório no mesmo instante são
idênticos, mas não existe uma "versão final assinada" arquivada em algum
lugar. Se a cooperativa precisar de prova de um documento exatamente como
foi emitido num momento específico (ex.: para auditoria externa), isso
exigiria guardar o PDF gerado em algum storage — dependência de infra,
documentada aqui, não implementada.

**Arquivos novos:** `src/lib/pdf/*` (7 arquivos),
`src/app/api/semanas/[weekId]/pdf/[report]/route.ts`,
`src/app/api/semanas/[weekId]/pdf/zip/route.ts`.
**Arquivos alterados:** `package.json`/`package-lock.json` (novas
dependências `@react-pdf/renderer` e `jszip`), `semanas/[weekId]/page.tsx`
(seção de documentos).

**Testes executados:**
- Automatizado: `tsc --noEmit` limpo, `eslint` limpo, `npm run test` (29
  testes, sem mudança de lógica de cálculo), `npm run build` OK (as duas
  rotas novas aparecem compiladas).
- Interface/banco (Playwright, dados fictícios): baixei os 7 PDFs
  individuais e o ZIP pra semana fechada de teste — todos retornam
  `200`, `Content-Type` correto, começam com a assinatura `%PDF`, e o
  ZIP contém os 7 arquivos certos. Renderizei os PDFs de verdade (via o
  visualizador nativo do Chromium, não só "o arquivo existe") e conferi
  visualmente que os números batem exatamente com o que as telas
  mostram (romaneio da CEI A SEMENTEIRA: Chuchu 30kg pedido / 0kg
  devolução / 30kg líquido; balanço: R$2.436,60 / R$615,00 / R$1.821,60
  / R$100,00 / R$1.721,60 — idênticos à tela). Criei uma segunda semana
  (Semana 2, ainda ABERTA, também fictícia) só pra confirmar que o aviso
  vermelho de "semana ainda aberta" aparece corretamente no PDF gerado
  pra uma semana aberta — confirmado visualmente.
- Não testado: geração de PDF sob muitas escolas simultâneas (a semana de
  teste só tinha 3 romaneios) — o código não tem limite artificial, mas
  não foi validado com a base completa de ~190 escolas com pedido; alerta
  de possível tempo de geração maior nesse caso, não medido.

#### Etapa 5 — detalhes (parcial: Excel feito, PDF não iniciado)

**O que foi implementado** (`docs/plano-de-implementacao.md` §13): fluxo
completo de importação do pedido das escolas via Excel — não é o
protótipo antigo (que só lia e mostrava na tela sem gravar nada). Agora:

1. Operador abre "+ Importar pedido da prefeitura (Excel)" em `/escolas`
   (só aparece com a semana aberta) e escolhe o arquivo `.xlsx`.
2. O arquivo é enviado pro servidor e lido lá (nunca só no navegador) —
   `previewSchoolOrdersImport` usa `exceljs` pra ler a planilha, acha a
   linha de cabeçalho procurando "CÓDIGO" (e opcionalmente "ESCOLA") nas
   primeiras 15 linhas, e casa cada coluna com um produto ativo pelo nome
   (normalizado — ignora acento/maiúscula) e cada linha com uma escola
   pelo código (normalizado — ignora espaço e um ".0" sobrando que o
   Excel costuma adicionar em código numérico).
3. Mostra uma prévia completa antes de gravar qualquer coisa: quantas
   linhas foram reconhecidas, o valor atual (se já havia pedido lançado)
   ao lado do novo valor vindo do arquivo, e quatro categorias de
   pendência tratadas SEM adivinhar nada:
   - código de escola não encontrado no cadastro;
   - coluna de produto não reconhecida;
   - célula com valor que não deu pra interpretar (nunca vira zero);
   - código de escola duplicado no arquivo (ambíguo — as linhas
     correspondentes ficam de fora, nenhuma delas é escolhida
     arbitrariamente).
   Linhas que parecem total/subtotal (nome contém "total"/"subtotal" e
   código vazio) são identificadas e ignoradas à parte, sem aparecer
   como "escola desconhecida".
4. Só depois de revisar a prévia o operador clica "Confirmar e
   importar" — aí sim `confirmSchoolOrdersImport` revalida tudo de novo
   no servidor (nunca confia no que veio do preview) e grava numa única
   transação: ou entra tudo, ou nada entra (testei isso de propósito —
   ver testes abaixo). Reaproveita exatamente as mesmas regras da Etapa
   1: preço congelado na criação, e bloqueio se a quantidade importada
   for menor que uma devolução já lançada pra aquela escola/produto (se
   isso acontecer em qualquer linha, a importação inteira é recusada com
   uma mensagem dizendo qual escola/produto causou o problema).
5. Reenviar o mesmo arquivo **substitui** os valores (upsert por
   escola+produto), nunca soma — testado explicitamente.
6. Rastreabilidade da origem sem mudar o schema: cada linha gravada pela
   importação vira um `AuditLog` com `action` `SCHOOL_ORDER_IMPORT_CREATE`
   ou `_UPDATE` e `reason` = `Importado de "<nome do arquivo>"` — dá pra
   auditar depois quais lançamentos vieram de importação e de qual
   arquivo, usando a auditoria que já existia (não criei tela nova).

**Bibliotecas:** `exceljs` (não usei o pacote `xlsx`/SheetJS porque a
versão do npm tem duas vulnerabilidades de segurança altas e sem correção
disponível — prototype pollution e ReDoS — exatamente no caminho de
analisar um arquivo enviado por alguém de fora, que é exatamente o que
essa funcionalidade faz; `exceljs` tem só um alerta moderado indireto,
numa dependência interna de geração de UUID que não é acionada pelo
nosso uso). Registrado aqui pra não ser uma escolha "silenciosa".

**Arquivos novos:** `src/lib/importSchoolOrders.ts` (lógica pura de
casamento/validação, testável sem banco), `importSchoolOrders.test.ts`
(12 testes), `src/app/actions/schoolOrdersImport.ts` (as duas Server
Actions), `src/app/(app)/escolas/ImportSchoolOrders.tsx` (UI).
**Arquivos alterados:** `escolas/page.tsx` (mostra o importador),
`package.json`/`package-lock.json` (nova dependência `exceljs`).

**Testes executados:**
- Automatizado: 12 testes novos cobrindo TODOS os casos do plano —
  vírgula decimal, código com formatação (espaço, ".0"), nome de produto
  com acento/caixa diferente, código de escola desconhecido, coluna de
  produto desconhecida, célula inválida, quantidade negativa, código
  duplicado (ambíguo), linha de total/subtotal, linha em branco, arquivo
  sem cabeçalho reconhecível. `tsc`, `eslint`, `npm run test` (41 testes
  no total agora), `npm run test:integration` (5), `npm run build` — todos
  limpos.
- Interface/banco (Playwright, arquivo `.xlsx` sintético gerado com
  `exceljs` contendo exatamente os casos acima, dados fictícios, semana
  de teste "Semana 2"): subi o arquivo de verdade pela tela, conferi a
  prévia (contagens batendo com o esperado: 5 reconhecidas, 1 código
  desconhecido, 1 duplicado, 1 célula inválida, 1 linha de total
  ignorada), confirmei a gravação, recarreguei a página e confirmei no
  banco que os valores persistiram certos. Reenviei o MESMO arquivo de
  novo e confirmei que o valor não duplicou/somou (upsert, não soma).
  Lancei manualmente uma devolução maior que um valor que a importação
  ia trazer, tentei importar, e confirmei que a importação inteira foi
  recusada (mensagem clara) E que, direto no banco, NENHUMA linha daquele
  arquivo foi gravada — nem as que não tinham problema (transação
  atômica de verdade, não só na teoria).
- **Não testado ainda**: o formato REAL da planilha da prefeitura — o
  usuário disse que vai mandar um exemplo assim que receber. Tudo aqui
  foi validado com a estrutura da v27/v35 (mesmo layout: CÓDIGO, ESCOLA,
  uma coluna por produto) e com dados sintéticos cobrindo os problemas
  que o plano pediu pra considerar. **Isto só pode ser declarado
  validado contra o formato real depois de testar o exemplo real** —
  exatamente como o próprio plano pede pra não presumir.

**O que NÃO foi feito nesta etapa (declarado, não escondido):**
1. **Importação por PDF — não iniciada.** O plano pede pra "distinguir
   texto extraível de imagem digitalizada" e "avaliar OCR" — isso é uma
   frente de trabalho separada e significativamente maior (biblioteca de
   OCR, heurística de confiança por campo, fluxo de conferência mais
   pesado que o do Excel). Como o Excel já cobre o caso mais provável
   (a prefeitura manda planilha) e o usuário disse que vai mandar um
   exemplo real "assim que receber", decidi não começar PDF às cegas
   nesta sessão. Fica como próximo passo claro, não como uma tela
   incompleta apresentada como pronta.
2. Resolução manual de pendências direto na tela de prévia (ex.: escolher
   manualmente qual escola corresponde a um código não encontrado) — hoje
   o operador precisa corrigir a planilha e reenviar, ou lançar essas
   linhas manualmente na tabela normal. Funcional, mas menos conveniente;
   registrado como melhoria futura, não como bug.
3. Guardar o arquivo original enviado — cada importação só grava os
   dados extraídos (via AuditLog), não o arquivo `.xlsx` em si. Guardar o
   arquivo original exigiria um lugar pra guardar (storage), que é
   infraestrutura — documentado como dependência pro olucasgon, não
   implementado.

**Próximo passo exato:** Etapa 6 concluída em seguida (ver subseção
"Etapa 6" logo abaixo e `docs/propostas-pendentes.md`). Todas as 6 etapas
do plano desta sessão estão feitas (Etapa 5 parcialmente — só Excel, PDF
não iniciado, ver acima). Ver `docs/relatorio-sessao.md` pro fechamento
completo desta sessão e o que fica pra amanhã.

#### Etapa 6 — detalhes (concluída)

Análise e documentação de 6 pontos do plano que dependem de decisão do
usuário e/ou mudança de schema/infraestrutura do olucasgon — nenhuma
implementação de código nem mudança de dado real, como pedido. Tudo em
`docs/propostas-pendentes.md`: entrega efetiva por escola (§8), cobrança
e fechamento com faltas (§9), pedidos de semanas futuras (§14), retirada
de Ovos do fluxo ativo (§15 — o código de importação já trata isso desde
o commit anterior; só falta o UPDATE de dado real, coordenado), backup
(§16), e divisão→pedido sem redigitar (§17). Cada item tem: o problema
real, uma proposta de formato (quando aplicável), e uma tabela final
resumindo quem decide o quê e o que cada decisão bloqueia ou não.

## Time
Duas pessoas trabalhando no repo agora: o usuário (com o Claude Code) e um
colaborador humano, **olucasgon**, que ele trouxe pra ajudar. Fluxo de
branches: `main` (produção) ← `staging` (pré-produção) ← `develop`
(trabalho em andamento, é onde tudo isso está acontecendo).

## App real (Next.js/Prisma) — o que o colaborador endureceu
O olucasgon adotou desenvolvimento orientado por especificação. A primeira
entrega está em `specs/001-integridade-operacional/` e reforçou regras
necessárias antes de qualquer piloto com usuário real:
- datas coerentes e só uma semana ABERTA por vez;
- fechamento de semana bloqueado se houver entrega pendente;
- proteção a nível de banco contra gravação em semana fechada;
- devoluções únicas por origem/produto/semana (constraint, não só validação
  de formulário);
- mutações críticas e o registro de auditoria na mesma transação;
- acumulado PNAE associado ao período real da entrega;
- credenciais do seed protegidas (não hardcoded/expostas).

Verificação local dele: 24 testes unitários, 5 testes de integração contra
`colheita_test`, TypeScript, ESLint, schema Prisma e build de produção —
tudo passando. Teste de interface cobriu login, todas as rotas principais,
criação/validação de semana, pedido escolar, confirmação de entrega,
fechamento, resumo, histórico e bloqueio de fechamento com pendência.

Ele também renomeou a página inicial autenticada pra `/painel` (era a raiz
`(app)/page.tsx`), adicionou um `src/app/page.tsx` novo (landing/root?),
componente `Icon.tsx`, reescreveu boa parte de `globals.css`, e configurou
um Postgres local isolado pra ele em `.local/postgres-data` (porta 5433) —
usar `npm run db:local:start` antes do servidor web depois de reiniciar.

**Próximo marco que ele definiu**: rodar um ciclo semanal completo de
homologação com usuários reais, em paralelo com a planilha, antes de
qualquer deploy de produção.

## Modelo de demonstração (Artifact, feito pelo Claude Code — não é o app real)
Link: https://claude.ai/artifact/DDRFektseWv8ZSDkTSyyqp
Protótipo em HTML/JS puro (sem backend), pra apresentar pro chefe e validar
decisões de UX/negócio ANTES de mexer no app de verdade. Fluxo: ajusta no
modelo → chefe aprova → só então implementa no código real (ainda não
implementado — ver lista abaixo).

### Mudanças já validadas no modelo — status no app real
1. **[FEITO] Unidade em kg/dz** — `src/lib/format.ts` (novo: `formatQty`,
   `formatQtyNumber`, `productUnit`) formata "120 kg" / "10 dz" sem
   decimais desnecessários, sabendo que Ovos (slug `ovos`) é dúzia, não
   kg. Aplicado em `resumo/page.tsx`, `painel/page.tsx` (pendências),
   `produtores/[internalId]/page.tsx` e `escolas/[code]/ReturnRow.tsx`.
   `weekSummary.ts` ganhou `productSlug` em `TreasuryLine`,
   `ProducerPaymentLine` e `PendingProducer.pendingProducts` pra viabilizar
   isso. Totais agregados multi-produto (linha "Pedido/Entrega" da tabela
   de produtores) usam só `formatQtyNumber` (sem unidade), já que somam
   produtos de unidades diferentes — mesma simplificação que já existia.
2. **[FEITO] Devolução como ação deliberada** — `ReturnRow.tsx` (ficha de
   escola) e `ProducerProductRow.tsx` (produtor) agora mostram um botão
   "+ Registrar devolução" (estilo `.link-action`) em vez de input vazio
   sempre visível; clicar revela o input + select de motivo. Estado
   inicial `revealed = returnedQty > 0`, então devolução já lançada
   continua editável direto, sem esconder dado real.
3. **[FEITO] Total no romaneio do produtor** — `produtores/[internalId]/page.tsx`
   ganhou `<tfoot>` com soma de pedido/entrega/devolução/valor.
4. **[FEITO] Limite Anual PNAE removido da interface** — painel de alerta
   tirado de `painel/page.tsx` (dashboard) e a barra/badge tirada de
   `produtores/[internalId]/page.tsx`. `src/lib/pnae.ts` e seus testes
   (unitários e de integração) continuam intactos — só a UI sumiu, o
   cálculo automático (usado pelo `weekPolicy.ts` do olucasgon) segue
   funcionando por baixo.
5. **[FEITO] Rótulo "Vendas Merenda Escolar (PMP)"** — trocado de "Vendas
   à Prefeitura" / "A cobrar da prefeitura" em `painel/page.tsx`,
   `resumo/page.tsx` e `semanas/[weekId]/page.tsx`. O Balanço Financeiro
   (`balanco/page.tsx`) não tinha nenhum stat-row de vendas antes — foi
   adicionado um novo `stat-row` (Vendas Merenda Escolar (PMP) / Pago aos
   Produtores / Margem Bruta) igual ao que existia no modelo, antes do
   `balance-hero`. Implicação estrutural (ainda NÃO modelada): `School`/
   `SchoolOrder` talvez devessem pertencer a um `Cliente` (PMP sendo o
   primeiro), pra somar vendas por cliente — decisão maior, avaliar com o
   usuário quando entrar, não fazia parte deste round de "ajustes
   pequenos".

   Validado: `tsc --noEmit` (só o erro conhecido/inofensivo de
   `LayoutProps` em `layout.tsx`, que se autocorrige com `next dev`/
   `build`), `eslint` limpo, 24 testes unitários + 5 de integração
   passando, `next build` de produção OK, e teste manual via Playwright
   contra o Postgres local com os dados reais da planilha (login, ficha de
   escola com e sem devolução prévia, ficha de produtor com total, tabela
   de produtores com o link de devolução, resumo/balanço/painel com o
   rótulo novo).
6. **Histórico clicável, abre detalhe da semana** — no app real isso já
   existe via `/semanas/[weekId]` e `/resumo?week=`/`/balanco?week=`; só
   confirmar que a navegação a partir de `/historico` está linkando certo.
7. **Mapa de Produção com os 12 meses** — o modelo antes só mostrava
   Outubro (limitação do protótipo); o app real (`/mapa-producao`) já
   mostra os 12 meses certos, isso nunca foi um problema nele.
8. **Importar pedido da Prefeitura (Excel)** — upload de .xlsx na tela de
   Pedido das Escolas via SheetJS: lê CÓDIGO/ESCOLA e casa colunas de
   produto pelo nome. Validado rodando o mesmo algoritmo em Node contra a
   estrutura real da aba "Entrada de Dados" (v27 e v35) — bateu exato.
   PDF não foi implementado (sem layout fixo da prefeitura não dá pra
   confiar). Precisa virar Server Action real (`saveSchoolOrder` em lote)
   + upload em `escolas/page.tsx`.

## Planilha de referência atualizada pra v35
Cópia salva em `docs/referencia-planilha/` (xlsx + resumo em md). Verifiquei
célula por célula contra o arquivo real, não só contra o resumo enviado:

1. **Aba "LIMITE ANUAL PNAE" foi removida da planilha.** Não muda a spec:
   o teto de R$40.000/produtor/ano continua sendo calculado automaticamente
   a partir do histórico semanal (já é assim no app real).
2. **Nova aba "MAPA DE MONTAGEM" — feature grande, ainda não existe no
   app.** Ferramenta de logística do galpão:
   - **18 rotas fixas**: Segunda S1–S10 (100 escolas / 95 paradas
     físicas), Terça T1–T8 (91 escolas / 85 paradas físicas) — confirmei a
     soma exata (191 escolas, 180 paradas).
   - **11 pares de escolas compartilham parada física** (mesmo endereço),
     marcados SUB "A"/"B" na mesma linha de PAR (nº da parada) — cada uma
     continua entidade separada pra pedido/devolução/romaneio.
   - Cada rota: nome + corredor, veículo-base sugerido, observação livre,
     sequência fixa de escolas (PAR., SUB, CÓDIGO, ESCOLA, BAIRRO, e uma
     coluna por produto que é fórmula `INDEX/MATCH` puxando da Entrada de
     Dados pelo código — **derivado, não digitado ali**).
   - Linha de controle por rota: "Peso previsto" = soma de todos os
     produtos **exceto Ovos** (fórmula confirmada) + 3 campos manuais:
     peso embarcado, veículo confirmado, motorista.
   - Provavelmente a tela mais usada no dia a dia de quem monta a carga.
     Ainda falta extrair a lista completa das 191 escolas por rota (só
     peguei os cabeçalhos das 18 rotas + amostra de S1–S3) — reler
     `docs/referencia-planilha/controle_escolas_produtores_2026_v35.xlsx`,
     aba "MAPA DE MONTAGEM", quando formos implementar. Vai precisar de
     schema novo (algo como `Route` + `RouteStop`, com peso
     embarcado/veículo/motorista por semana).
3. **Ovos é "(dz)" — dúzia, não kg.** Confirmado em todas as abas
   relevantes. Pagamento não muda (qtd × preço), mas nenhum total "em kg"
   pode somar Ovos (por isso o Peso Previsto do Mapa de Montagem exclui a
   coluna de Ovos explicitamente).
4. **Devolução não pode passar do pedido/entrega** — já implementado nos
   dois lados de forma independente: nas Server Actions originais
   (`saveSchoolReturn`/`saveProducerReturn`) e agora reforçado pelo
   olucasgon como constraint única por origem/produto/semana. Alinhado
   com a v35, nada pendente aqui.
5. **Aba "DIFERENÇA" ganhou STATUS automático por produto**: `FALTA`
   (vermelho) se entregue < pedido, `SOBRA` (amarelo) se entregue >
   pedido, `OK` (verde) se igual — comparação por produto (não por
   escola). Bom padrão visual pra copiar num painel/tela nova; ainda não
   existe equivalente no app nem no modelo.
6. Mudanças só de organização da planilha (índice, filtro, cor visual das
   paradas compartilhadas) — sem efeito na lógica de negócio.

## Pendências combinadas (minhas + sugestões do olucasgon — convergem bastante)
1. Rodar o ciclo semanal de homologação com usuários reais (marco definido
   pelo olucasgon) antes de qualquer deploy de produção.
2. [FEITO — ver seção acima] Os 5 ajustes pequenos (kg/dz, devolução
   deliberada, total no romaneio, remover PNAE da UI, rótulo PMP). Faltam
   ainda os 3 ajustes maiores da lista original: histórico clicável
   (só confirmar), mapa de produção 12 meses (já ok) e import de Excel
   (não implementado no app real ainda — só validado no modelo).
3. Extrair as 18 rotas completas do Mapa de Montagem e modelar `Route`/
   `RouteStop` no schema — feature nova, ninguém começou ainda.
4. Ajustar formatação de unidade (kg vs dz) em todo lugar que soma/exibe
   quantidade — cuidado especial com Ovos.
5. Avaliar a tela/painel de "Diferença" (status FALTA/SOBRA/OK por
   produto).
6. Decidir se/quando modelar "Cliente" como entidade própria (PMP sendo o
   primeiro) pra sustentar o rótulo "Vendas Merenda Escolar (PMP)".
7. Importação assistida e anonimização dos dados da planilha (sugestão do
   olucasgon — converge com o upload de Excel que já prototipei).
8. Gestão de usuários e tela de auditoria pela UI.
9. Relatórios e exportação financeira.
10. Backup, restauração e observabilidade.
11. Isolamento por cooperativa, se/quando isso virar produto pra mais de
    uma cooperativa.

## Próximo passo exato
Os 5 "ajustes pequenos" do modelo (kg/dz, devolução deliberada, total no
romaneio, remover PNAE da UI, rótulo "Vendas Merenda Escolar (PMP)") foram
portados pro app real na branch `develop`, validados (tsc, eslint, 29
testes, build de produção, teste manual via Playwright com dados reais) e
commitados. Falta: push pro `develop` remoto e alinhar com o usuário qual
item entra a seguir — candidatos: import de Excel na tela de escolas
(Server Action + upload), Mapa de Montagem (feature grande, schema novo),
ou aguardar o ciclo de homologação semanal do olucasgon (pré-requisito
dele pro deploy de produção).
