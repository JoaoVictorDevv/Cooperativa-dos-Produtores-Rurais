# Colheita — estado atual

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
