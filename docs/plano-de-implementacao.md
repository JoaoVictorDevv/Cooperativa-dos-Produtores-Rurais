# Plano de implementação — Colheita

Este arquivo tem duas partes:

1. **Rodada 2 (vigente, a partir de 24/09/2026)** — logo abaixo. Orientada
   pelo prompt `docs/prompts/2026-09-24-prompt-v2-operacao-specs-develop.md`
   (cópia integral). É a única lista de etapas em vigor.
2. **Rodada 1 (histórico, 22–23/09/2026)** — mais abaixo, preservada como
   registro. Onde a Rodada 1 contradiz a Rodada 2, vale a Rodada 2 (ver
   "Hipóteses e regras substituídas").

O `memory.md` e o `docs/relatorio-sessao.md` registram o progresso real e o
ponto de retomada. As regras de produto ficam em `specs/` (fonte de verdade).

---

## Rodada 2 — operação real, specs e integração na develop

### Estado do Git no início da rodada (26/09/2026, conferido)

- `origin/develop` = `2997ac2`: merge (feito pelo João Victor em 25/09) de
  `origin/feat/relatorios-diferencas-importacao` (`194f5f9`) com o commit do
  Lucas `3e77064` (API Java em `api/`, PostgreSQL novo em `database/`). O
  merge foi limpo (nenhum conflito resolvido à mão).
- Todos os 9 commits da Rodada 1 já estão na develop. **Não há merge a
  repetir.** A branch de trabalho `feat/relatorios-diferencas-importacao` foi
  avançada por fast-forward até `2997ac2` e segue como branch de trabalho.
- `main`/`staging` = `fcfc7f5` (não tocar).

### Regras desta rodada (não violar)

- Integração e push na `develop` **autorizados** pelo Lucas depois de
  validação (typecheck, lint, build, testes). Sem force push, sem reescrever
  histórico, sem `main`/`staging`, sem produção.
- Não alterar schema, migrações, seed, conexão, credenciais, infraestrutura,
  `api/` ou `database/` (área do Lucas). Mudanças necessárias nessas áreas
  viram dependência documentada em `docs/propostas-pendentes.md`.
- Não expandir o Prisma antigo para criar um segundo núcleo operacional. Não
  migrar telas para a API Java sem contrato combinado.
- Não consultar nem modificar banco real. Testes destrutivos só em banco
  comprovadamente descartável — nome com "test" não basta.
- Preservar visual atual (inclusive a camada "Colheita 2.0" do Lucas), auth,
  permissões e auditoria automática.
- Não declarar pronto o que só tem documentação, componente sem persistência
  ou regra testada em memória.

### Hipóteses e regras substituídas (histórico preservado)

| Antes (Rodada 1 / specs antigas) | Agora (regra confirmada com Seu Paulo) | Onde está a regra nova |
|---|---|---|
| "Não integrar na develop" | Integração autorizada após validação | este plano, §Regras |
| Cobrança da prefeitura = pedido − devolução ("regra vigente até decisão") | Cobrança = quantidade **aceita pela escola** (entregas + complementos − rejeições escolares). A fórmula antiga continua no código **só** até existir fonte persistida de entrega por escola/produto — não se troca a fórmula sem essa fonte | `specs/008-recebimentos-faltas-fechamento/spec.md` |
| Pagamento ao produtor sujeito a qualquer devolução | Produtor recebe pelo **aceito no galpão**; rejeição na escola é perda da cooperativa, nunca descontada do produtor | spec 008 |
| Proposta de carregar reposição pendente para a semana seguinte | Proibido. Cada falta é resolvida por complemento no mesmo ciclo ou **encerrada sem atendimento** antes do fechamento; não vira pedido/cobrança/pendência na semana seguinte | spec 008 |
| Uma entrega por escola por semana | Pode haver complementos no mesmo ciclo; cada evento preserva o anterior | spec 008 |
| Fechamento bloqueia só por "entrega registrada" (CA-03.1/03.2) | Fechamento separa recebimento conferido / valor calculado / pronto para fechar; faltas precisam de decisão | spec 008 (CA-03.* da spec 001 continuam valendo como mínimo técnico até a substituição) |
| Import lê só a primeira aba e procura "CÓDIGO" | Seleção explícita de abas, cabeçalho Pedido/Entrega em 2 linhas, só colunas de Pedido | `specs/009-importacao-pedido-prefeitura/spec.md` |
| Backup verificado rodando `npm run test:integration` na cópia restaurada | Proibido: a suíte chama `resetDb()` e apaga o que foi restaurado. Verificação de restauração só com leituras | `docs/propostas-pendentes.md` §5 |

### Etapas da Rodada 2 — lista única de estado

Legenda: `[ ]` pendente · `[~]` em andamento · `[x]` concluído e validado ·
`[B]` bloqueado (dependência externa) · `[P]` preparado sem integração.

- [x] **R2-0 Diagnóstico e registro** (commit `78baa41`); proteção de testes destrutivos por banco descartável comprovado (spec 001, T10) concluída depois — Git, specs, API/DB do Lucas, arquivos
  GZ e MODELO v20; prompt salvo; este plano; commit+push antes de
  implementar.
- [x] **R2-1 Specs** (004, 008, 009 + adendo 001) — criar `specs/008-recebimentos-faltas-fechamento`,
  `specs/009-importacao-pedido-prefeitura`, promover `SPEC-004 Relatórios e
  exportações` do backlog para `specs/004-relatorios-exportacoes`, adendo na
  001 (testes seguros, substituição de CA-03). Atualizar `specs/README.md` e
  `specs/backlog.md`.
- [P] **R2-2 Núcleo de domínio** (spec 008) — regras puras e 32 testes feitos (commit `6f907ac`); preparado sem integração — funções puras + testes:
  galpão (bruto−rejeição=aceito), escola (apresentado−rejeição=aceito),
  complementos, falta/excedente, perda pré-escola × rejeição escolar, estados
  de conferência e "pronto para fechar". **Persistência: [B] Lucas** (não há
  tabela de entrega por escola/produto nem de complemento/decisão de falta).
- [x] **R2-3 Importação Excel** (spec 009) — ver `specs/009…/tasks.md`; falta só validar com arquivo oficial [B] — motor novo (abas, cabeçalho 2
  linhas, Pedido×Entrega, zero explícito, `1.000`, colunas duplicadas,
  conflito código×nome, fórmula sem resultado, precisão, unidades), prévia
  com seleção de abas e resolução de pendências, confirmação atômica com
  revalidação no servidor. Testes com estrutura do GZ e sintético de 191
  escolas.
- [x] **R2-4 Importação PDF com texto** (spec 009) — layout tabular simples testado; PDF oficial não testado [B] — extração local, sem
  serviço externo; reaproveita prévia/confirmação. OCR: [B] infraestrutura
  não autorizada.
- [x] **R2-5 Documentos** (spec 004) — ver `specs/004…/tasks.md`; romaneio de complemento/aceite real [B] spec 008 — romaneio com "Data da entrega /
  Horário da entrega" manuais, conferência em branco, opção de 4 vias sem
  duplicar dados; cabeçalho de ciclo e de tabela repetidos por página,
  paginação; aviso de modelo antigo em "Entregas às Escolas"; teste com 191
  escolas; Ovos no histórico.
- [x] **R2-6 Interface confiável** (commit `cd85967`) — `useState(initialValue)` desatualizado
  após importação/troca de ciclo; rótulos "A cobrar/A pagar/Resultado
  calculado"; Ovos fora de novos lançamentos (regra de app, sem mexer no
  banco).
- [x] **R2-7 Contrato de integração para o Lucas** (`docs/propostas-pendentes.md` §7) — backend alvo, sessão,
  organização/IDs, histórico, endpoints, divisão de trabalho; revisão
  técnica da API (devolução × recebimento, preço histórico no upsert,
  fechamento). Em `docs/propostas-pendentes.md`.
- [x] **R2-8 Validação e integração** — merge `fce91a3` na develop, push confirmado — tsc, lint, build, testes; merge na
  develop + push; confirmar commits em `origin/develop`; relatório e
  retomada.
- [ ] **R2-10 Divisão → pedido aos produtores com prévia** (propostas §6) —
  independente do Lucas; próxima etapa sugerida.
- [B] **R2-9 Mapa de Montagem** (Etapa 7 do prompt) — só depois do núcleo
  validado com persistência real. Não iniciar nesta rodada enquanto R2-2
  estiver bloqueado.

Critérios de conclusão de cada etapa: estão nos `tasks.md` das specs
correspondentes, vinculados aos critérios de aceite.

### Exemplos de teste (onde estão)

- `Planilha_de_Pedido_22-06-2026_-_GZ_Alimentos.xlsx` — anexo do prompt v2,
  modelo de **outra operação**, usado só para testar formato. Não é
  versionado no repositório. Os testes automatizados usam uma reprodução
  sintética da estrutura dele (`src/lib/import/fixtures/`). Há um teste
  opcional que roda contra o arquivo real se a variável `GZ_XLSX_PATH`
  apontar para ele.
- `controle_escolas_produtores_2026_MODELO_v20.xlsx` — referência atual de
  campos, cálculos e romaneios (anexo do prompt v2). Não versionado.
- `TESTE_CICLO_FINANCEIRO_v3.xlsx` — citado no prompt, **não foi anexado**
  nesta sessão.

---

## Rodada 1 (histórico) — Diferenças, Histórico/PDFs, Importação

Branch de trabalho na época: `feat/relatorios-diferencas-importacao` (criada a
partir da `develop`, commit `6d632cb`). Integrada na develop em `2997ac2`.

## Regras gerais da Rodada 1 (históricas — ver Rodada 2 para as vigentes)

- Preservar as implementações do olucasgon e os 5 ajustes do commit `6d632cb`
  — esse commit é referência de trabalho concluído, não um ponto para
  reverter.
- Não alterar: conexão/credenciais de banco, schema Prisma, migrações, seed,
  infraestrutura de backup. Mudanças que exigem isso ficam documentadas como
  proposta para o olucasgon, sem implementar.
- Não rodar reset, seed ou testes destrutivos contra dados de operação. Testes
  automatizados só com proteção explícita de banco de teste (não basta o nome
  `.env.test`).
- Trabalhar nesta branch própria. Não integrar na `develop`, não tocar
  `main`/`staging`, não fazer deploy, não usar force push.
- Uma etapa por vez: implementar, testar, documentar, commit. Repetir.
- Não apresentar funcionalidade incompleta como pronta. Distinguir código
  inspecionado / teste automatizado / teste com banco / teste de interface /
  cenário não validado.
- Não ampliar escopo além do pedido.

## Plano por etapas (ordem de dependência)

1. **Correções de consistência e salvamento** (prompt §4, §5, §6) — sem
   dependência de schema; ajustes em Server Actions e componentes client
   existentes. Prioridade 1, pode começar imediatamente.
   - 4A: bloquear redução de entrega/pedido abaixo de devolução já registrada
     (produtor e escola).
   - 4B: permitir correção explícita para zero (devolução, entrega),
     distinguindo "não conferido" de "zero confirmado".
   - 4C: feedback de salvando/salvo/erro mais claro nos componentes client
     existentes; conferir que os totais batem após reload.
   - 5: preservar preço/desconto históricos ao corrigir quantidade/data;
     testar semana reaberta.
   - 6: proteção explícita de banco exclusivo de testes antes de qualquer
     teste destrutivo.

2. **Painel Diferença do galpão** (prompt §7) — usa dados já existentes
   (pedidos de escola, entregas/devoluções de produtor). Sem schema novo.

3. **Histórico semanal completo e PDFs** (prompt §10, §12) — reaproveita
   telas existentes; PDFs por semana selecionada (aberta ou fechada), não só
   a semana aberta.

4. **Melhorias de navegação** — decorrente do histórico consolidado (§10).

5. **Importação Excel/PDF funcional** (prompt §13) — fluxo completo leitura →
   conferência → confirmação → gravação. Aguarda exemplo real da prefeitura
   para validação final; desenvolver e testar com dados fictícios enquanto
   isso.

6. **Documentação de dependências de banco e decisões operacionais** — feita
   ao longo de cada etapa acima quando aplicável, e consolidada nas seções
   abaixo que são só análise/proposta nesta sessão:
   - §8: entrega efetiva por escola (proposta, sem schema/migração agora).
   - §9: cobrança/fechamento considerando faltas (documentar decisões
     pendentes, preservar regra atual pedido−devolução).
   - §14: pedidos de semanas futuras (documentar proposta, sem mudar a regra
     de semana única).
   - §15: retirada de Ovos do fluxo ativo (implementar o que for só
     código/UI; documentar o que exigir banco).
   - §16: backup (levantamento e proposta, sem alterar infraestrutura).
   - §17: melhoria de praticidade (divisão → pedido de produtores), como
     proposta se depender de definição operacional.
   - §18: fora de escopo nesta sessão (gestão de usuários, tela de
     auditoria, Mapa de Montagem).

Testes (prompt §19) e relatório final (prompt §20, §21) acompanham cada
etapa e o encerramento da sessão.

## Prompt completo (verbatim, recebido nesta sessão)

> Registre também no memory.md o nome exato da branch de trabalho. Após criar
> essa branch, salve o plano completo em docs/plano-de-implementacao.md, faça
> commit e envie para essa branch no GitHub antes de começar as
> implementações.
> Salve o prompt completo deste trabalho em docs/plano-de-implementacao.md.
> No memory.md, registre o progresso de cada etapa e o próximo passo, fazendo
> referência a esse arquivo.
> Continuidade do trabalho: trabalhe em uma etapa por vez. Ao concluir cada
> etapa, atualize o memory.md com o que foi implementado, os arquivos
> alterados, os testes executados, as pendências e o próximo passo exato.
> Faça commits das etapas concluídas e envie para a branch separada deste
> trabalho, respeitando as restrições deste prompt.
>
> Não espere o contexto acabar para registrar o progresso. Se precisar
> interromper, deixe também um relatório curto, em português simples,
> explicando o que funciona, o que está incompleto e o que depende do Lucas.
> Informe o último commit e se o push foi concluído. Não registre
> funcionalidades incompletas como prontas.
>
> Continue automaticamente pelas etapas independentes enquanto houver
> capacidade. Se a sessão for retomada, confira o código, o Git e o
> memory.md antes de continuar, evitando refazer trabalho já concluído.
> Continue o desenvolvimento do aplicativo da cooperativa usando este prompt
> como orientação consolidada desta sessão.
>
> A planilha Excel v35 é a referência das regras operacionais. O app deverá
> controlar o ciclo semanal: pedido das escolas, divisão e pedido aos
> produtores, recebimento no galpão, entrega às escolas, devoluções,
> diferenças, documentos e resultado financeiro.
>
> Preserve as implementações do olucasgon e os cinco ajustes enviados no
> commit `6d632cb`. Esse commit é uma referência do trabalho concluído, não
> uma instrução para voltar a uma versão antiga.
>
> **1. Conferir o projeto e criar uma branch própria**
>
> Leia o `memory.md`, as instruções do projeto e o estado atual do código e
> do GitHub.
>
> Preserve alterações locais existentes e identifique o que já funciona, o
> que está parcial e o que falta. Não refaça funcionalidades concluídas.
>
> Crie uma branch própria a partir da `develop` atualizada, por exemplo
> `feat/relatorios-diferencas-importacao`.
>
> Nesta sessão:
>
> * Faça commits e envie essa branch ao GitHub;
> * Não integre na `develop`;
> * Não altere `main` ou `staging`;
> * Não faça deploy;
> * Não use force push.
>
> O trabalho ficará disponível para revisão e alinhamento com o olucasgon
> amanhã.
>
> **2. Banco de dados e coordenação com o olucasgon**
>
> O olucasgon está trabalhando na integração com o banco. A parte de
> estrutura e infraestrutura será alinhada com ele.
>
> Não alterar:
>
> * Conexão, credenciais ou configuração do banco;
> * Schema Prisma;
> * Migrações;
> * Seed;
> * Infraestrutura de backup.
>
> Não executar operações no banco real, reset, seed ou testes destrutivos
> sobre dados de operação.
>
> Uma branch separada não isola um banco compartilhado. Use dados fictícios,
> testes isolados e somente um banco comprovadamente exclusivo de testes
> quando necessário.
>
> É permitido desenvolver funcionalidades e corrigir regras usando a
> estrutura atual. Se alterar funções de gravação, destaque os arquivos no
> relatório para revisão do olucasgon.
>
> Quando uma tarefa exigir mudanças reservadas ao banco, documente a
> proposta e continue em outra tarefa independente. Não contorne a
> limitação guardando dados em campos inadequados, arquivos soltos ou
> armazenamento do navegador.
>
> **3. Trabalhar em etapas e continuar nas partes independentes**
>
> Primeiro organize o plano conforme as dependências.
>
> Priorize:
>
> 1. Correções de consistência e de salvamento;
> 2. Painel Diferença do galpão;
> 3. Histórico e PDFs semanais;
> 4. Melhorias de navegação;
> 5. Importação Excel/PDF;
> 6. Documentação das dependências de banco e decisões operacionais.
>
> Ajuste a ordem quando houver uma dependência concreta.
>
> Conclua uma etapa por vez: implemente, teste, documente e faça um commit
> coerente. Depois continue automaticamente para a próxima tarefa
> independente.
>
> Se depender do Lucas, de uma decisão operacional ou do exemplo real da
> prefeitura, registre a pendência e avance no que for possível.
>
> Não tente resolver todo o projeto em uma única alteração. Não amplie o
> escopo para preencher o tempo.
>
> **4. Corrigir consistência e salvamento**
>
> Verifique e corrija estes cenários no código atual:
>
> A. Redução abaixo de uma devolução existente:
>
> * Entrega de 100 kg;
> * Devolução de 20 kg;
> * Tentativa de reduzir a entrega para 10 kg.
>
> Bloquear a alteração e explicar que a devolução precisa ser conferida.
> Aplicar o princípio também ao pedido escolar no modelo atual.
>
> Não apagar ou reduzir devoluções automaticamente.
>
> B. Correção para zero:
>
> * Uma devolução registrada precisa poder ser corrigida para zero;
> * Uma entrega de produtor precisa poder ser registrada ou corrigida para
>   zero quando confirmada;
> * Zero confirmado deve ser diferente de campo não conferido.
>
> Verificar os retornos antecipados da interface que impedem enviar zero
> para salvar.
>
> C. Confirmação de gravação:
>
> * Mostrar "salvando", "salvo" ou erro de forma clara;
> * Não apresentar uma alteração malsucedida como persistida;
> * Confirmar os valores após recarregar a página;
> * Garantir que os totais correspondam aos dados salvos.
>
> As regras devem funcionar no servidor, nas edições e nas futuras
> importações. Considerar operações simultâneas.
>
> Se a solução exigir mudança de schema ou infraestrutura, documentar a
> dependência para o olucasgon.
>
> **5. Preservar preços, descontos e histórico**
>
> Ao corrigir quantidade ou data, verificar se o sistema preserva o preço e
> o desconto associados ao lançamento.
>
> Não substituir silenciosamente esses valores pela configuração atual. Uma
> correção financeira deverá ser explícita e rastreável.
>
> Testar semanas reabertas e a preservação de períodos antigos.
>
> Distinguir:
>
> * Valor previsto pelo pedido;
> * Valor apurado;
> * Valor a pagar ou receber;
> * Pagamento ou recebimento efetivamente registrado.
>
> Não chamar um cálculo de "pago" se não houver comprovação registrada de
> pagamento.
>
> Não recalcular semanas antigas com regras novas silenciosamente.
>
> **6. Segurança dos testes**
>
> Antes de executar testes que limpam tabelas, garantir uma proteção
> explícita que confirme um banco exclusivo de testes. Comentários e o nome
> `.env.test` não bastam por si só.
>
> Pode corrigir a proteção no código dos testes sem alterar infraestrutura
> ou credenciais.
>
> Se não houver ambiente seguro, não executar testes destrutivos. Informar
> o que foi validado e o que ficou pendente.
>
> **7. Painel Diferença do galpão**
>
> Implementar usando a estrutura existente e a lógica da v35.
>
> Por produto e semana, mostrar:
>
> * Pedido total das escolas;
> * Entrega bruta dos produtores;
> * Devoluções aos produtores;
> * Entrega líquida = entrega bruta menos devoluções;
> * Diferença = entrega líquida menos pedido das escolas.
>
> Status:
>
> * `FALTA`: entrega líquida menor que o pedido;
> * `SOBRA`: entrega líquida maior;
> * `OK`: valores iguais.
>
> Exibir quantidade e status, com vermelho, amarelo e verde acompanhados de
> texto.
>
> Permitir semanas abertas e fechadas, filtros e acesso aos detalhes.
>
> Essa diferença não representa automaticamente estoque atual do galpão nem
> atendimento individual de cada escola. Não misturar essas informações.
>
> Não somar unidades diferentes em um total de peso.
>
> **8. Entrega efetiva por escola — proposta para alinhar com o Lucas**
>
> Precisamos saber o que cada escola realmente recebeu.
>
> Exemplo:
>
> * Pediu 20 kg;
> * Recebeu 15 kg;
> * Ficaram 5 kg não entregues.
>
> Falta não é devolução. Não usar devolução para esconder uma entrega
> parcial.
>
> Analisar e propor a menor adaptação necessária para registrar, por
> semana, escola e produto:
>
> * Pedido;
> * Entrega efetiva;
> * Devolução;
> * Quantidade líquida aceita;
> * Quantidade não entregue;
> * Reposição vinculada ao pedido original.
>
> Distinguir não conferido de zero confirmado. Não transformar o pedido
> automaticamente em entrega confirmada.
>
> Explicar como tratar reposições de faltas e de devoluções sem contar
> quantidades duas vezes.
>
> Não criar schema ou migrações nesta sessão. Documentar a proposta para o
> olucasgon e o usuário.
>
> Não apresentar uma tela fictícia como controle integrado.
>
> **9. Cobrança e fechamento com faltas**
>
> Hoje parte do cálculo escolar utiliza pedido menos devolução. Antes de
> substituir essa regra, explicar o impacto e confirmar como a cooperativa
> apura a cobrança considerando entrega, aceite, devolução e reposição.
>
> O pedido não é comprovação de entrega. Preservar a regra atual enquanto a
> mudança não estiver definida.
>
> Também distinguir:
>
> * Operação não conferida;
> * Falta confirmada;
> * Reposição pendente.
>
> Semana fechada não significa necessariamente pedido totalmente atendido.
>
> Documentar as decisões necessárias:
>
> * Quando uma falta justificada permite fechar a semana;
> * Como acompanhar reposição em outra semana;
> * Como preservar documentos e valores originais.
>
> Não mudar essas regras silenciosamente.
>
> **10. Histórico semanal completo e interface prática**
>
> Aproveitar as telas existentes para oferecer uma página central por
> semana, com:
>
> * Pedido das escolas;
> * Divisão e pedidos aos produtores;
> * Entregas e devoluções no galpão;
> * Confirmações e devoluções escolares existentes;
> * Diferenças calculáveis;
> * Valores e balanço;
> * Acesso aos documentos.
>
> Integrar entregas e faltas detalhadas por escola quando a estrutura
> correspondente estiver aprovada e funcional.
>
> Calcular os totais a partir dos registros, sem digitação duplicada.
>
> Preservar o histórico das alterações por meio da auditoria existente, sem
> criar uma nova tela de auditoria.
>
> A interface deve:
>
> * Identificar claramente a semana selecionada;
> * Mostrar totais e situações de forma simples;
> * Permitir clicar em escolas, produtores e diferenças para abrir
>   detalhes;
> * Oferecer filtros úteis;
> * Mostrar erros e estados vazios compreensíveis;
> * Permitir consulta de semanas antigas sem reabri-las;
> * Manter o padrão visual do projeto.
>
> Não apresentar dados inexistentes como se estivessem registrados.
>
> **11. Indicadores de atendimento semanal**
>
> Mostrar apenas indicadores sustentados pelos registros disponíveis.
>
> Após existir a entrega efetiva por escola, incluir:
>
> * Escolas totalmente atendidas;
> * Escolas com falta;
> * Escolas aguardando conferência;
> * Quantidades pedidas e entregues por produto;
> * Situação das reposições.
>
> Explicar como os indicadores são calculados. Confirmação de uma entrega
> não comprova atendimento integral.
>
> Usar os indicadores para acompanhar a operação, sem apresentá-los como
> medida automática da produtividade individual dos produtores.
>
> **12. PDFs da semana e documentos históricos**
>
> Permitir selecionar a semana e baixar:
>
> * Pedido das escolas;
> * Pedidos aos produtores;
> * Romaneios das escolas;
> * Resumo do recebimento e das devoluções no galpão;
> * Resumo das entregas com os dados disponíveis;
> * Relatório de diferenças;
> * Balanço financeiro.
>
> Permitir arquivos individuais e pacote ZIP.
>
> Aproveitar a impressão de romaneios existente, mas fazer as consultas
> usarem a semana selecionada, e não apenas a semana aberta.
>
> Os documentos devem:
>
> * Funcionar para semanas abertas e fechadas;
> * Identificar semana e data de emissão;
> * Informar quando a semana ainda está aberta;
> * Usar registros e preços do período;
> * Ser legíveis e prontos para impressão;
> * Distinguir pedido de entrega confirmada;
> * Manter documentos separados para escolas que compartilham endereço.
>
> Respeitar as permissões inclusive no ZIP.
>
> Verificar se alterações de nome ou endereço no cadastro mudariam um
> documento antigo regenerado. Explicar a diferença entre consultar dados
> históricos e reproduzir exatamente um documento emitido.
>
> Se preservar versões finais dos documentos exigir nova infraestrutura ou
> estrutura de dados, documentar para o Lucas. Não prometer reprodução
> idêntica sem suporte real.
>
> **13. Importação funcional de Excel ou PDF**
>
> A importação dos pedidos da prefeitura é essencial. Aproveitar o
> protótipo, mas desenvolver o fluxo completo: leitura, conferência,
> confirmação e gravação.
>
> Vou enviar um exemplo real assim que o receber. Não presumir que o
> formato é igual à v35.
>
> O fluxo final deverá:
>
> * Selecionar a semana;
> * Receber Excel ou PDF;
> * Identificar escolas, preferencialmente pelo código;
> * Identificar produtos, unidades e quantidades;
> * Mostrar prévia por escola e produto;
> * Apontar dados inválidos, desconhecidos, ambíguos e duplicados;
> * Permitir resolver pendências;
> * Mostrar diferenças em relação a pedidos existentes;
> * Confirmar antes de gravar;
> * Validar no servidor e respeitar as regras atuais.
>
> Considerar:
>
> * Vírgula decimal;
> * Nomes diferentes para produtos;
> * Códigos com formatação;
> * Arquivos com várias páginas ou abas;
> * Cabeçalhos repetidos;
> * Subtotais e totais;
> * Reenvio e revisão do mesmo pedido.
>
> Não adivinhar associações duvidosas. Não transformar erro em zero.
>
> Não converter caixas, unidades ou dúzias em kg sem regra explícita. Se
> faltar a conversão, exigir resolução antes de gravar.
>
> Para PDF, distinguir texto extraível de imagem digitalizada. Quando
> necessário, avaliar OCR e exigir conferência de leituras duvidosas.
>
> Reimportação não deve duplicar quantidades. Revisões não devem apagar ou
> substituir registros silenciosamente.
>
> Preservar a identificação da origem e, conforme armazenamento aprovado, o
> arquivo original. Se isso exigir mudança no banco ou infraestrutura,
> documentar a dependência.
>
> Desenvolver e testar o possível agora. O suporte ao formato real da
> prefeitura só poderá ser declarado validado após testar o exemplo.
>
> Não apresentar uma tela de upload ou um leitor sem gravação completa como
> importação concluída.
>
> **14. Pedidos de semanas futuras**
>
> O sistema atual permite apenas uma semana aberta. Analisar como receber o
> pedido da próxima semana enquanto a atual ainda está em operação.
>
> Documentar uma solução de preparação ou planejamento futuro, sem remover
> silenciosamente a regra de semana única e sem misturar lançamentos de
> períodos diferentes.
>
> Não criar estados ou migrações nesta sessão. Alinhar a mudança necessária
> com o olucasgon.
>
> **15. Retirada de Ovos do fluxo ativo**
>
> A decisão é retirar Ovos dos novos lançamentos, pois não há produtor para
> esse fornecimento.
>
> Preservar registros históricos e a unidade correta nos documentos
> antigos. Não apagar referências existentes.
>
> Verificar os efeitos em formulários, importação, resumos e totais. Se um
> pedido importado trouxer Ovos, mostrar que o produto não é atendido pelo
> fluxo ativo; não ignorar a linha silenciosamente.
>
> Se a desativação exigir operação no banco reservado ao olucasgon,
> preparar o código compatível e documentar a aplicação pendente.
>
> **16. Backup — parte a alinhar com o olucasgon**
>
> O objetivo é recuperar todos os dados necessários da operação semanal,
> incluindo uma semana ainda aberta.
>
> PDFs e histórico dentro do próprio banco não substituem backup.
>
> Nesta sessão:
>
> * Verificar o que existe;
> * Documentar requisitos e dependências;
> * Propor armazenamento, frequência e retenção para alinhamento;
> * Descrever como testar restauração em ambiente separado.
>
> Não alterar a infraestrutura de banco ou backup. Não apresentar scripts
> preparados como backups automáticos em funcionamento.
>
> **17. Melhorias de praticidade a avaliar**
>
> A divisão planejada e o pedido aos produtores devem continuar
> conceitualmente separados da entrega real.
>
> Avaliar se o fluxo exige redigitar a mesma quantidade na divisão e no
> pedido. Se adequado e compatível com a estrutura existente, propor uma
> ação explícita de confirmar a divisão e gerar os pedidos, com prévia e
> sem duplicidades.
>
> Não implementar automatismos que alterem entregas reais ao mudar o
> planejamento.
>
> Registrar essa melhoria como proposta se depender de definição
> operacional. Não expandir o escopo à custa das prioridades principais.
>
> **18. O que fica para depois**
>
> * Gestão de usuários: manter login e permissões existentes.
> * Tela de auditoria: preservar os registros automáticos sem criar a tela.
> * Mapa de Montagem: não implementar rotas, paradas, veículos, motoristas
>   ou cargas nesta sessão.
>
> O controle escolar deve ser planejado para funcionar independentemente da
> futura tela de rotas.
>
> Não modificar a planilha Excel nesta tarefa. Suas correções serão feitas
> separadamente.
>
> **19. Testes e preservação**
>
> Testar cada funcionalidade implementada, com dados fictícios e ambiente
> isolado.
>
> Cobrir os cenários aplicáveis:
>
> * Edição, salvamento e recarregamento;
> * Valores zero e campos não conferidos;
> * Devoluções e redução posterior de pedido/entrega;
> * Operações simultâneas;
> * Importação inválida, repetida e revisada;
> * Unidades diferentes;
> * Diferenças por produto;
> * PDFs de semanas abertas e fechadas;
> * Permissões individuais e do ZIP;
> * Preços e descontos históricos;
> * Navegação do histórico.
>
> Comparar os cálculos existentes com a v35 usando os mesmos dados,
> incluindo arredondamentos. Não copiar os problemas da planilha.
>
> Documentar testes futuros das funcionalidades dependentes do banco:
> entrega parcial por escola, reposições, cobrança, fechamento com faltas e
> restauração de backup.
>
> Diferenciar:
>
> * Código inspecionado;
> * Teste automatizado executado;
> * Teste com banco;
> * Teste de interface;
> * Cenário ainda não validado.
>
> Não apresentar build ou testes unitários aprovados como validação de toda
> a operação.
>
> **20. Relatório compreensível e memória**
>
> Ao parar, deixar um relatório em português claro no repositório,
> explicando:
>
> * O que foi feito;
> * O que mudou para quem usa o app;
> * O que funciona;
> * O que está apenas preparado;
> * Como testar, com passos simples;
> * Testes e resultados;
> * Problemas encontrados;
> * Dependências do exemplo da prefeitura;
> * Dependências do Lucas;
> * Decisões operacionais pendentes;
> * Próximos passos.
>
> Incluir ao final uma seção técnica curta com principais arquivos
> alterados, alterações de banco propostas, branch, commits e situação do
> push.
>
> Não entregar somente comandos ou termos técnicos.
>
> Atualizar o `memory.md` com resumo, decisões, pendências e caminho do
> relatório.
>
> **21. Salvar e enviar o trabalho**
>
> Fazer commits coerentes por etapa e enviar para a branch própria.
>
> Não integrar na `develop` nesta sessão, não alterar `main` ou `staging`,
> não publicar e não usar force push.
>
> Ao encerrar, informar:
>
> * Nome da branch;
> * Commits;
> * Confirmação do push;
> * Caminho do relatório;
> * Alterações que ficaram somente locais;
> * O que está pronto para revisão;
> * O que precisa ser alinhado amanhã.
>
> Preservar o trabalho do colaborador. Conflitos posteriores de regras de
> negócio devem ser explicados, sem escolher silenciosamente um dos lados.
