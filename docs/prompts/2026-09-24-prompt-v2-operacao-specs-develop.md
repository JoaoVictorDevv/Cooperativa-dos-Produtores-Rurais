# Prompt atualizado — Colheita: operação, specs e integração na develop

Revisão de 24/09/2026, após autorização do Lucas para integrar e enviar à develop. Este arquivo substitui as restrições antigas que impediam essa integração. As regras da operação e as demais restrições permanecem. O prompt anterior fica preservado como histórico.

Continue a partir do estado atual do projeto, preservando o trabalho da branch `feat/relatorios-diferencas-importacao` e as implementações do olucasgon. Lucas autorizou integrar o trabalho validado e fazer push na `develop`; não é necessário pedir essa autorização novamente. Confira primeiro o que já foi integrado para não repetir merges. Use a branch existente para preparar e validar as mudanças antes da integração, conforme o fluxo abaixo. Este prompt reúne as regras confirmadas da cooperativa e exige specs suficientes para outro agente continuar o projeto sem depender desta conversa.

Não execute versões antigas do plano que contradigam estas regras. Principalmente: não carregar faltas automaticamente para outra semana; não cobrar pelo pedido quando a escola recebeu menos; não descontar do produtor rejeições ocorridas na escola após a aprovação do galpão.

## 0. Estado observado no Git e prioridade desta rodada

Este diagnóstico foi feito por leitura do repositório e execução de funções puras, sem acessar banco, iniciar a aplicação, executar migrações ou alterar branches remotas. Confira novamente o estado atual antes de agir: os hashes abaixo são uma fotografia de 24/09/2026, não uma instrução para voltar a eles.

- `origin/feat/relatorios-diferencas-importacao`: `194f5f9`. Contém os nove commits da rodada do Claude, incluindo importação básica de Excel, Diferença do Galpão, histórico, sete tipos de PDF/ZIP e correções de integridade.
- `origin/develop`: `3e77064`, do olucasgon, com a nova API Java/Spring Boot em `api/` e novo PostgreSQL em `database/`.
- Base comum: `6d632cb`. A `develop` tem um commit exclusivo e a branch do Claude tem nove exclusivos. O código novo do Lucas ainda não está integrado na branch do Claude. Isso não significa que os nove commits foram apagados.
- `origin/main` e `origin/staging`: `fcfc7f5` na consulta.
- `origin/claude/pnae-excel-structure-djoy3c`: recebeu o merge `ae2ba64` da `develop`. Ela não passa a ser automaticamente a branch desta tarefa.

**Constatação central:** as telas Next.js e Server Actions consultadas continuam usando Prisma diretamente. A API nova usa outro contrato de persistência: schema `colheita`, IDs UUID e `organization_id`. Ela não está ligada ao fluxo das telas consultadas. Não basta trocar a URL do banco para conectar essas estruturas.

Tanto o Prisma existente quanto o SQL novo mantêm `SchoolDelivery`/`school_deliveries` como confirmação de data por escola/ciclo, sem quantidades por produto e com uma única entrega por escola/ciclo. As entregas dos produtores também têm unicidade por produtor/produto/ciclo. Portanto, o suporte necessário para eventos de complementos, recebimento escolar e resolução de faltas ainda precisa ser definido e implementado com Lucas.

A cobrança antiga continua em `src/lib/calc.ts` e também em `database/migrations/V003__integrity_permissions_and_views.sql`: pedido menos devolução. No teste puro com pedido 200, apresentação escolar 180 e rejeição escolar 10, `schoolNetQty(200,10)` retornou 190; a regra confirmada exige 170. Não use os testes antigos dessa fórmula como aprovação da regra nova.

Falhas reproduzidas no motor de importação da branch do Claude (`src/lib/importSchoolOrders.ts`):
- Zero explícito é descartado da prévia, impedindo atualizar um pedido de 20 para zero pelo fluxo normal.
- Texto `1.000` é interpretado como 1 sem confirmação da ambiguidade.
- Duas colunas do mesmo produto geram duas linhas para a mesma escola/produto sem aviso de duplicidade de coluna.
- Código 2044 com nome de outra escola é associado pelo código, sem alertar o conflito de nome.
- Ao fornecer as células das abas do exemplo GZ ao motor de conferência, ele rejeitou os cabeçalhos: procura uma coluna literal CÓDIGO nas primeiras 15 linhas. O servidor também lê apenas a primeira aba. Este teste foi do motor de leitura, não um teste de upload, gravação e interface completos.

Na API do Lucas, registrar para revisão técnica conjunta:
- O serviço operacional consultado não verifica devolução contra recebimento/pedido e a migração SQL consultada restringe valores negativos, mas não implementa essa comparação entre registros. Não considerar a regra protegida só porque há validação no frontend antigo.
- O upsert de entrega de produtor aceita substituir `price_id` e `logistics_deduction_snapshot` enviados pelo cliente. A preservação dos preços/descontos históricos precisa ser garantida no servidor também nessa API.
- O fechamento atual verifica existência de registros de entrega; ainda não representa aceite por produto, complementos e decisão sobre faltas.

**Não faça uma migração de arquitetura por conta própria.** Primeiro documente um contrato de integração para Lucas: backend de destino, autenticação/sessão, organizações/IDs, dados históricos, endpoints e quem implementa cada parte. A direção indicada pelo commit é API Java separada, mas isso não autoriza migrar telas, credenciais e dados sem alinhamento.

A integração de código entre a branch de trabalho e a `develop` está autorizada. Incorpore os commits existentes do Lucas pelo fluxo de merge e validação abaixo, preservando seus arquivos. Isso não autoriza alterar schema, migrações, seed, conexão, credenciais, infraestrutura ou assumir a implementação da API reservada ao Lucas. Até o alinhamento técnico, leia `api/` e `database/`, preserve o código que já está na develop e documente mudanças necessárias nessas áreas como dependências. Continue nas correções independentes, parser, documentos, usabilidade e testes de domínio. Não expanda o Prisma antigo para criar um segundo núcleo operacional concorrente. Diferencie explicitamente integrar commits no Git de conectar efetivamente as telas à nova API.

O núcleo completo só poderá ser declarado funcional quando tiver persistência e integração reais. Documentação, componentes demonstrativos e testes simulados não substituem essa entrega.

## 1. Continuidade, plano e limites

Antes de implementar:
- Leia `AGENTS.md`, `CLAUDE.md`, `memory.md`, `docs/plano-de-implementacao.md`, `docs/relatorio-sessao.md`, `docs/propostas-pendentes.md`, `specs/README.md`, `specs/backlog.md` e as specs, planos e tarefas existentes que cobrem os fluxos desta rodada. Inclua `specs/001-integridade-operacional/spec.md`, `plan.md` e `tasks.md`, além de incrementos posteriores encontrados. Confira o código e os commits atuais, inclusive `api/README.md`, `api/ARCHITECTURE.md`, `api/docs/openapi.yaml` e `database/README.md` da develop. Não considere specs antigas automaticamente corretas nem tarefas marcadas como prova de implementação: confronte-as com código e testes.
- Se uma especificação chamar a cobrança por pedido menos devolução de “regra absoluta”, registre que ela foi substituída pelas regras confirmadas neste prompt para o novo fluxo. Não apague o histórico dessa mudança nem reinterprete automaticamente semanas antigas.
- Confira branch, alterações não commitadas e commits locais/remotos. Não presuma que o último commit informado anteriormente ainda seja o mais recente.
- Preserve mudanças de outras pessoas. Não descarte arquivos nem volte a uma versão antiga. Não refaça etapas comprovadamente concluídas.
- Registre este prompt completo no repositório e atualize o plano com etapas, dependências, critérios de conclusão e próximo passo. Marque as hipóteses antigas como substituídas, preservando o histórico das decisões.
- Faça commit e push dessa documentação antes das implementações, desde que não haja um bloqueio real de acesso ou conflito que precise ser informado.

Restrições mantidas:
- Prepare as mudanças na branch de trabalho existente e integre o conjunto validado na `develop`, com push autorizado. Não altere `main`/`staging`, não publique em produção e não use force push, reset destrutivo ou reescrita de histórico compartilhado.
- Não altere schema, migrações, seed, conexão, credenciais ou infraestrutura do banco. Essas partes continuam reservadas ao Lucas.
- Não consulte nem modifique banco real. Use dados fictícios e apenas um banco comprovadamente exclusivo de testes, já disponibilizado de forma compatível com essas restrições.
- Preserve autenticação, permissões e registros automáticos de auditoria. Não criar gestão de usuários nem tela de auditoria agora.
- Preserve o visual atual do aplicativo e as alterações do Lucas. Não redesenhe para copiar o modelo de demonstração; melhore somente o necessário à operação e à legibilidade.
- Não altere arquivos Excel originais. O `controle_escolas_produtores_2026_MODELO_v20.xlsx`, anexado, é a referência atual de campos, cálculos e romaneios — já validada em rodadas anteriores (avisos de fechamento, complementos, impressão A4). Não use uma versão anterior (v4 ou outra) como referência: partes da lógica abaixo foram corrigidas depois dela. O `TESTE_CICLO_FINANCEIRO_v3.xlsx` contém dados fictícios. Nenhum deles é prova de que todas as regras estão corretas ou foi usado para faturamento. As regras confirmadas abaixo prevalecem sobre fórmulas e mensagens antigas.

Trabalhe por etapas pequenas, teste cada comportamento relevante, atualize specs e documentos, faça commits claros e salve o progresso na branch de trabalho. Ao concluir um conjunto coerente e validado, integre e envie à develop pelo fluxo da seção 1.2. Continue pelas tarefas independentes sem parar apenas para anunciar a próxima etapa. Antes de uma interrupção, deixe um ponto de retomada explícito. Não prometa execução depois de encerrada a sessão ou esgotada a cota.


## 1.1. Specs obrigatórias para continuidade por outro agente

Siga a organização já adotada em `specs/README.md`. As specs explicam o comportamento e suas razões; o código implementa; os testes demonstram o que foi validado.

- Leia as specs passadas antes de criar novas. Verifique IDs e escopos existentes. Reaproveite ou complemente um incremento quando for o mesmo assunto; crie um incremento com o próximo número disponível quando for uma mudança distinta. Não invente uma estrutura paralela.
- Cada incremento deve ter `spec.md`, `plan.md` e `tasks.md`, conforme o padrão do repositório. Mantenha `specs/README.md` e `specs/backlog.md` atualizados.
- Na spec, registre objetivo, fluxo de quem opera, regras confirmadas com Seu Paulo, exemplos numéricos, critérios de aceite, exclusões, estados e preservação do histórico.
- No plano, registre componentes envolvidos, backend atual e pretendido, fontes de dados, contratos necessários, responsabilidades de Claude/Lucas, riscos e estratégia de testes. Pode descrever uma migração necessária, mas não executá-la quando estiver reservada ao Lucas.
- Nas tarefas, vincule implementação e testes aos critérios de aceite. Diferencie pendente, em andamento, concluído e bloqueado. Uma tarefa de documentação concluída não conclui a funcionalidade que ela descreve.
- Registre quais requisitos já existiam antes desta rodada e quais serão corrigidos. Não apresente importação, PDFs ou histórico existentes como recriados do zero.
- Se uma regra antiga conflitar com as decisões confirmadas, documente a substituição, motivo, alcance e transição do histórico. Atualize referências para que nenhum agente encontre duas regras vigentes incompatíveis.
- Cubra os temas deste prompt: recebimentos separados e responsabilidades financeiras; complementos/faltas/fechamento; importação Excel/PDF; documentos e histórico; integridade e testes seguros. Agrupe de forma coerente, sem criar um documento para cada pequeno ajuste.
- Registre evidência dos testes executados, ambiente, limitações e commits correspondentes. Não inclua senhas, tokens, URLs com credenciais ou dados reais desnecessários.
- Antes de parar, deixe em `docs/relatorio-sessao.md` um ponto de entrada para outro agente: specs relevantes, estado atual, último commit/push, o que funciona, bloqueios, próximo passo exato, arquivos envolvidos e comandos seguros de verificação.
- O outro agente deve conseguir continuar apenas com os arquivos do repositório. Não dependa da memória desta conversa ou de um anexo que não esteja disponível. Identifique os exemplos de teste e onde encontrá-los; não versione dados pessoais ou arquivos de produção indiscriminadamente.

## 1.2. Integração na develop autorizada pelo Lucas

A autorização está concedida para integrar e enviar código/documentação validados à `develop`. Não peça confirmação de rotina novamente. Ela não significa autorização para produção, alteração do banco real ou migração de arquitetura.

1. Confira `git status`, branches, remotos e alterações locais. Atualize as referências remotas e compare os históricos. Preserve trabalho alheio e alterações não commitadas; use checkout/worktree isolado se necessário.
2. Verifique se os commits da branch `feat/relatorios-diferencas-importacao` já estão na develop. Se já estiverem, não repita a integração; trabalhe a partir da develop atual usando uma branch coerente com as instruções do repositório. Não perca commits ainda exclusivos da feature.
3. Quando houver divergência, integre a develop atual na branch de trabalho por merge, preservando o histórico compartilhado. Resolva conflitos pelo significado do código e das regras, sem escolher todos os arquivos de um lado automaticamente. Um conflito de arquitetura sem informação suficiente é bloqueio específico: documente-o e continue tarefas independentes.
4. Implemente por etapas conforme as specs. Antes de integrar na develop, valide o resultado combinado com typecheck, lint, build e testes relevantes conforme as instruções e ferramentas do projeto. Testes com banco só em ambiente isolado comprovadamente seguro; registre verificações indisponíveis.
5. Integre apenas conjuntos coerentes, com documentação e verificações proporcionais à mudança. Trabalho incompleto que quebra o fluxo existente fica na branch de trabalho, com pendências claras; não desative funcionalidades para conseguir um build verde.
6. Verifique workflows e proteções existentes. Respeite checks e exigências de PR; não os desative nem contorne. Se push/merge em develop disparar publicação em produção, não o execute sob esta autorização: registre esse bloqueio específico, sem alterar infraestrutura por conta própria.
7. Atualize novamente a develop remota antes da integração. Se Lucas tiver enviado novos commits, incorpore-os e verifique as áreas afetadas; não sobrescreva o remoto nem use force push.
8. Integre e faça push na develop quando as verificações necessárias estiverem satisfeitas. Se o repositório exigir PR, abra-o com resumo e testes e use o fluxo permitido; caso falte uma revisão obrigatória, informe o PR pendente sem declarar merge concluído. Não envie mensagens a outras pessoas automaticamente.
9. Confirme quais commits chegaram a `origin/develop` e se o push foi concluído. Atualize specs, relatório e retomada. Não confunda “commit local”, “push da feature”, “merge na develop” e “deploy”: são resultados diferentes.
10. Ao interromper, salve o progresso seguro na branch de trabalho mesmo se a integração ainda não puder ocorrer, informando exatamente a situação. Não marque etapas não validadas como prontas só para enviá-las à develop.

## 2. Objetivo e dependências do Lucas

O objetivo é uma operação real, fácil de usar, com quantidades, valores e documentos coerentes. Upload, telas demonstrativas e cálculos apenas em memória não contam como funcionalidade concluída. A restrição de não alterar banco/API do Lucas continua valendo: ela pode impedir concluir o núcleo nesta rodada, e isso deve ser relatado claramente, sem repetir pedidos de aprovação para tarefas independentes já autorizadas.

Primeiro identifique o suporte existente para: recebimentos do produtor, rejeições no galpão, entregas por escola/produto, rejeições na escola, complementos, data/horário real, conferência, encerramento da falta e vínculo com o ciclo.

Implemente o que o banco atual comportar corretamente. Quando faltar estrutura:
- Documente em `docs/propostas-pendentes.md` o dado necessário, a regra, o contrato esperado, a necessidade de preservar históricos e os testes de aceitação para Lucas.
- Pode preparar regras de domínio, testes e componentes desacoplados. Identifique claramente o que ainda não está conectado nem persistido.
- Não armazene dados operacionais em observações, campos com outro significado, arquivos paralelos, localStorage ou dados fictícios para contornar a restrição do banco.
- Não publique telas que pareçam salvar algo sem persistência. Não troque a fórmula financeira isoladamente antes de existir uma fonte confiável da entrega real.
- Continue as correções independentes. Relate o bloqueio do núcleo operacional sem afirmar que está concluído.

Estas regras de negócio já estão confirmadas; não são propostas aguardando decisão. O que pode depender de Lucas é sua implementação no banco e a integração técnica.

## 3. Ciclo real da cooperativa

1. Quarta ou quinta: a prefeitura envia o pedido por escola e produto, baseado na oferta que a cooperativa informou a partir do Mapa de Produção. Previsão de produção não confirma recebimento nem distribui pedidos automaticamente.
2. A cooperativa divide a demanda e emite pedidos aos produtores.
3. Domingo e segunda: os produtores entregam no galpão; o administrador confere e rejeita o que estiver ruim.
4. Segunda e terça: a cooperativa entrega às escolas; merendeira ou diretora confere e assina o romaneio.
5. Na quarta seguinte: o ciclo é conferido e encerrado; a nota fiscal é emitida pelo processo já utilizado pela cooperativa.

Mantenha um identificador de ciclo e suas datas. Pedido da quinta anterior, recebimento no domingo e entrega na segunda devem permanecer ligados ao mesmo ciclo, mesmo atravessando a semana do calendário. Não reatribua registros antigos automaticamente.

Há uma entrega semanal programada, mas pode haver complemento/reposição dentro do mesmo ciclo antes do fechamento. Não adotar a hipótese de que só pode existir um evento de entrega por escola/produto.

Preparar um pedido futuro não deve exigir adulterar ou fechar o ciclo atual. Se isso exigir mudança na regra de semana única aberta ou no banco, documente para Lucas; não remova essa proteção indiscriminadamente.

Não implementar emissão fiscal eletrônica nesta rodada. O aplicativo deve fornecer documentos e totais conferidos para o faturamento.

## 4. Regra central: dois recebimentos, duas responsabilidades

Nunca confundir:
- Quantidade pedida pela prefeitura;
- Quantidade solicitada a cada produtor;
- Quantidade entregue e aceita no galpão;
- Quantidade entregue e aceita na escola.

**No galpão:**
- Entrega bruta do produtor menos rejeição no galpão = quantidade aceita do produtor.
- Essa quantidade é a base do valor a pagar ao produtor, usando o preço e o desconto de logística já combinados e registrados.
- Produto que o produtor não entregou também não pode ser pago como recebido. Não registrar ausência de entrega como devolução.

**Na escola:**
- Quantidade apresentada na entrega menos rejeição da escola = quantidade aceita pela escola.
- A prefeitura paga pela quantidade efetivamente aceita pela escola, conforme conferência, incluindo complementos aceitos no mesmo ciclo.
- Rejeição na escola, depois da aprovação no galpão, é perda da cooperativa. Não descontar do produtor.
- Não gerar desconto automático de motorista ou funcionário. Registrar a ocorrência e o motivo conhecido, sem inventar culpados.

**Exemplo obrigatório:**
- Escola pediu 200 kg de alface.
- Produtor entregou 200 kg; galpão rejeitou 20 kg; aceitou 180 kg.
- Escola recebeu uma entrega bruta de 180 kg, rejeitou 10 kg e aceitou 170 kg.
- Base para pagar o produtor: 180 kg.
- Base para cobrar a prefeitura: 170 kg.
- Falta de atendimento: 30 kg.
- Rejeição no galpão: 20 kg; perda da cooperativa na escola: 10 kg.

Não chamar os 30 kg faltantes de perda após o recebimento no galpão. Não descontar as rejeições duas vezes. Não reduzir automaticamente o pagamento do produtor para 170 kg.

## 5. Pedidos e divisão entre produtores

- Preserve o pedido original e suas alterações auditadas; não reduza o pedido para fazê-lo coincidir com uma entrega parcial.
- Importar o pedido da prefeitura preenche pedidos escolares, não entregas confirmadas nem pedidos aos produtores automaticamente.
- O gerente decide como distribuir a demanda e, na falta de produto, como atender as escolas. O app não faz rateio silencioso.
- Aproveite divisão e pedido aos produtores existentes. Deixe claro se uma divisão é apenas planejamento ou já virou pedido emitido.
- Se houver suporte, permitir confirmar a divisão para gerar/atualizar pedidos aos produtores com prévia e sem duplicação. Se faltar suporte, documentar para Lucas; não prometer uma ligação que ainda não existe.
- Mostre diferenças entre demanda e pedidos aos produtores sem obrigar o operador a digitar os mesmos números duas vezes.

## 6. Conferência e entregas reais

Reutilize telas e fichas existentes. Diferencie os campos brutos, rejeitados e aceitos para evitar dupla subtração.

No galpão, registrar por produtor/produto/ciclo: entrega bruta, rejeição, motivo, conferência e quantidade aceita calculada. Preserve o pedido ao produtor separado.

Na escola, registrar por escola/produto/ciclo: pedido automático, entrega bruta, rejeição, motivo e quantidade aceita calculada. Registrar data e horário real da entrega e quem recebeu/conferiu, quando o suporte de persistência estiver disponível.

- Vazio significa não informado; zero confirmado significa que a conferência ocorreu e aquela quantidade é zero.
- Não preencher entregas automaticamente a partir dos pedidos.
- O operador deve conseguir conferir os produtos de uma escola em uma tela, salvar de forma clara e corrigir ocorrências sem redigitar pedidos.
- Campos de rejeição/motivo devem aparecer quando necessários, mantendo simples a entrega normal.
- Se existir ação “conferir conforme documento”, exigir confirmação explícita das quantidades. Não tratar um clique como prova de recebimento não conferido.
- Romaneio assinado é o comprovante da conferência; não implementar upload de assinatura digital ou anexos como requisito adicional nesta rodada.

Perdas de transporte/manuseio antes da apresentação à escola, quando registradas, precisam ser ocorrências distintas das rejeições escolares. Não inventar uma rejeição da escola para explicar produto que nem chegou até ela. Ambas são posteriores ao aceite do galpão e não reduzem o pagamento ao produtor.

Não interpretar toda diferença entre galpão e escolas como perda: pode haver produto ainda não entregue, sobra no galpão ou conferência pendente. Quando faltar rastreamento para explicar um saldo, mostre “saldo a conferir”, sem inventar estoque ou causa.

## 7. Complementos e resolução das faltas

O gerente pode buscar outro produtor e completar o atendimento dentro do mesmo ciclo.

- Registrar cada complemento sem apagar a entrega inicial, suas rejeições ou seus horários.
- Vincular à escola, produto, ciclo e pedido original; registrar também o fornecimento de origem no controle do galpão, sem presumir que o produtor original fez a reposição.
- Somar as quantidades aceitas das entregas e complementos; impedir duplicação por reenvio ou duplo clique.
- A reposição reduz a falta, mas não apaga uma perda já ocorrida.
- Novo fornecimento aceito entra no cálculo do respectivo produtor. Não transferir valores indevidamente entre produtores.

Falta = máximo entre pedido menos total aceito pela escola e zero.
Excedente = máximo entre total aceito e pedido e zero.

Não confundir correção de um lançamento errado com nova entrega física. Correções devem ser auditadas; nova entrega deve preservar o evento anterior.

Não compensar falta de uma escola com excesso de outra nem falta de um produto com sobra de outro. Manter visíveis excedentes; não limitar silenciosamente os registros para que caibam no pedido.

## 8. Fechamento na quarta-feira

Separe explicitamente **dados de recebimento conferidos**, **valor calculado** e **ciclo pronto para fechar**. Uma escola pode ter aceite confirmado e valor calculado, mas ainda faltar a decisão sobre atendimento parcial. Não use um único OK ou mensagem verde para essas situações.

- Ciclo sem pedido e sem movimentação: mostrar “Aguardando pedido” ou equivalente, sem afirmar que toda a operação foi conferida.
- Pedido existente com recebimento vazio: pendente, nunca zero confirmado.
- Recebimento inicial vazio com complemento aceito: não esconder a pendência só porque existe complemento. Se a entrega original não ocorreu, exigir confirmação explícita de zero ou um evento equivalente que confirme a ausência, conforme contrato do banco.
- Faltas com situação vazia ou em resolução impedem apresentar o ciclo como pronto para fechar. “Resolvida” não é um atalho manual para ignorar uma falta numérica: o total aceito precisa comprovar o atendimento. Para fechar com quantidade faltante, a decisão correta é “Encerrada sem atendimento”.
- Em toda alteração posterior de entrega, rejeição ou complemento, recalcular a situação e detectar decisões que ficaram incoerentes.


Substitua a proposta antiga de carregar reposições pendentes para a próxima semana por esta regra confirmada:
- Antes de encerrar, cada falta deve estar resolvida por complemento ou encerrada como não atendida, com registro da decisão/motivo pelo responsável autorizado.
- Uma falta encerrada sem atendimento permanece no histórico, mas não vira pedido, cobrança ou pendência automática na semana seguinte.
- Permitir fechamento com atendimento parcial devidamente conferido e encerrado. Não exigir que todas as faltas numéricas sejam zero.
- Bloquear registros não conferidos, valores inconsistentes e decisões ainda em aberto, conforme suporte técnico disponível.
- Mostrar uma prévia com totais, rejeições/perdas, faltas encerradas, valor a cobrar e valor a pagar antes da confirmação.
- Fechamento é uma ação deliberada, não uma tarefa automática de quarta-feira. Não criar uma reabertura ou alteração silenciosa de semana fechada.

Alterar as regras atuais de fechamento apenas junto com a representação correta desses estados e testes. Se depender do banco, documente a implementação necessária para Lucas.

## 9. Financeiro e preservação do histórico

Autoriza-se adaptar a base da cobrança das escolas ao recebimento efetivo aceito quando os registros e a integração estiverem completos. Isso não autoriza mudar preços, percentuais, custos ou regras de logística.

- A pagar ao produtor: quantidade aceita no galpão, com preço/desconto histórico apropriado.
- A cobrar da prefeitura: quantidade aceita pela escola, incluindo complementos do mesmo ciclo, com preço histórico apropriado.
- Preservar a representação de preços e descontos congelados. Corrigir quantidade não deve reaplicar a configuração atual silenciosamente.
- Corrigir uma rejeição errada para zero deve funcionar e deixar auditoria; não exigir exclusão física do histórico.
- Manter dinheiro com a precisão e arredondamento consistentes do sistema; evitar diferenças entre tela, PDF e totais.
- Rejeição escolar não pode alterar automaticamente recebimento ou valor do produtor.
- Não lançar uma perda novamente como despesa se seu efeito já está refletido no menor valor a cobrar com o mesmo valor a pagar.
- Quantificar perdas em kg. Se mostrar valor monetário, identificar método/base e não afirmar custo exato por produtor quando não houver rastreabilidade suficiente.

Resumo: visão dos pedidos, recebimentos, rejeições, quantidades aceitas, valores a cobrar/a pagar e margem calculada.
Balanço: valores financeiros consolidados, custos reais registrados e resultado após custos.

Usar “A pagar”, “A cobrar” e “Resultado calculado” quando não houver registro de quitação. Não apresentar esses valores como fluxo de caixa efetivamente recebido/pago.

Semanas antigas que não têm entrega real registrada não podem ganhar esse dado por suposição. Preserve valores e documentos históricos; identifique a metodologia antiga e a ausência de confirmação. Documente para Lucas uma transição explícita para o novo modelo, sem recalcular o passado com zero ou com dados inventados.

## 10. Diferenças e produtividade semanal

Preserve “Diferença do galpão”: pedido total das escolas versus recebimento líquido dos produtores. Não chamar esse número de estoque atual nem de falta efetivamente sofrida por uma escola.

Acrescente, quando houver dados persistidos, a visão de atendimento das escolas: pedido, total aceito, falta/excedente, rejeições e situação de resolução. Permitir abrir os detalhes da escola/produto a partir do resumo.

- “Entrega registrada” é diferente de “Pedido atendido”. Não usar um único OK para ambos.
- Exibir não informado como pendência de conferência, sem fingir zero confirmado.
- Mostrar FALTA, SOBRA/EXCEDENTE e OK com textos, quantidades e cores; diferenciar falta em resolução e encerrada sem atendimento.
- Mostrar quantidade não atendida, rejeição no galpão e perda da cooperativa separadamente.
- Se apresentar percentual de atendimento, explicar a base; para demanda zero mostrar não aplicável. Excesso numa escola/produto não aumenta artificialmente o atendimento de outro.
- Preservar a unidade e não somar dúzias com kg.

Não construir um painel complexo separado se for possível tornar os resumos atuais claros e navegáveis.

## 11. Importação assistida de Excel

**O exemplo já existe e está anexado a este prompt:** `Planilha_de_Pedido_22-06-2026_-_GZ_Alimentos.xlsx`. Não peça o anexo de novo nem diga que está aguardando esse arquivo. Ele é um modelo recebido de outra operação, usado só para testar o formato de importação — não é o pedido oficial da cooperativa para faturar, e nunca deve ser tratado como tal.

No arquivo consultado há oito abas, incluindo quatro `Modalidade - ...`, `TOTAL`, `UE`, `EMEI` e `CEI`. Confira quais contêm detalhes relevantes, épocas distintas e totalizações. Não some tudo como se fossem pedidos diferentes. Nas abas de modalidade examinadas há cabeçalhos em duas linhas: uma distingue **Pedido/Entrega**, a outra identifica produtos; a coluna que contém códigos não aparece como CÓDIGO no formato simples esperado pelo parser. Adapte a leitura com reconhecimento verificável e seleção/mapeamento explícito, sem mudar o arquivo de origem.

- Importar somente as colunas de **Pedido** para pedidos escolares. A coluna **Entrega** do exemplo não comprova recebimento na nossa operação.
- Considerar somente produtos da oferta ativa da cooperativa; listar o que ficou fora. Ovos não entra no fluxo ativo.
- Usar códigos como chave principal, conferindo nomes. Um código igual com nome de outra instituição é conflito, não associação automática. Diferenças simples de abreviação não são autorização para equiparar instituições diferentes.
- Testar os conflitos conhecidos do exemplo: código 2044 (Padre Quinha no GZ / Santo Antônio no nosso cadastro) e 3016 (Soroptimista / Pedras Brancas). Não corrigir cadastros ou mapear silenciosamente.
- Nomes genéricos como Alface, Couve, Maçã e Tangerina não autorizam concluir Lisa, Manteiga, Gala e Ponkan. Permitir confirmação explícita de associação, preservando a origem e sem exigir confirmar de novo uma decisão persistida e válida.
- Se regras de associação persistidas exigirem banco novo, oferecer a conferência manual por importação por enquanto; não gravar esses mapeamentos em observações/localStorage como banco alternativo.
- Não exigir “191 escolas importadas” se o exemplo contém escolas diferentes. Informar exatamente quantas foram reconhecidas, ficaram pendentes ou foram excluídas por decisão. Testar separadamente um arquivo sintético com as 191 escolas válidas do cadastro.
- Reconciliação deve separar total de origem, escopo oferecido, exclusões, itens pendentes, total confirmado e valores efetivamente gravados. Não usar a planilha já transcrita como única prova de que o GZ foi lido corretamente.
- Preserve a precisão original na prévia. Os modelos atuais usam quantidades com duas casas decimais; se o arquivo tiver mais casas, mostre a diferença e aplique somente uma regra de precisão explicitamente definida. Se exigir schema, documente para Lucas. Não arredonde silenciosamente nem “corrija” totais para bater.


Preserve e corrija o fluxo: escolher ciclo → enviar arquivo → identificar abas/escolas/produtos/unidades → prévia → resolver pendências → confirmar → salvar pedidos.

Verifique os problemas anteriormente apontados no código atual; não presuma que já foram corrigidos porque a importação básica funciona:
- Zero explícito deve poder atualizar 20 para 0. Vazio e item ausente não autorizam apagar dados automaticamente.
- Detectar produtos/colunas duplicados e duplicidade de escola/produto. Não deixar a última ocorrência sobrescrever silenciosamente.
- Tratar números como “1.000” sem adivinhar quando houver ambiguidade; considerar tipo/formato da célula e exigir conferência quando necessário.
- Erros de célula e fórmulas sem resultado disponível são pendências, não zero/vazio.
- Reconhecer unidades ou exigir associação explícita. Não converter caixas/unidades para kg sem regra confirmada.
- Permitir selecionar as abas relevantes; não ler somente a primeira silenciosamente.
- Mostrar linha/célula de origem dos problemas e permitir corrigir associações ou explicar como resolvê-las.
- Exclusões deliberadas e importação parcial precisam estar claras na confirmação.

Revalidar no servidor: permissão, ciclo, status, cadastros ativos permitidos, quantidade/precisão, duplicidade, conflitos com registros e mudanças ocorridas após a prévia.

Preserve as proteções atuais de devolução enquanto a representação antiga existir. No novo modelo, a rejeição escolar é limitada pela entrega real, não pelo pedido. Não mantenha uma validação incorreta apenas copiando a fórmula antiga; não permita que revisões apaguem entregas/rejeições já ocorridas.

Não reduzir automaticamente pedido para esconder falta, nem apagar recebimento ao revisar pedido. Alterações conflitantes devem ser explícitas e auditadas.

Salvar de forma atômica, com proteção contra reenvio e edição concorrente. Reimportar o mesmo pedido não soma tudo novamente. Testar 191 escolas e os produtos ativos, duração e limites de transação, sem introduzir salvamento parcial escondido.

## 12. Importação de PDF

Importar o arquivo de pedido da prefeitura significa extrair dados e gravar os pedidos após conferência; não é apenas anexar ou visualizar o PDF.

- PDF com texto: implementar extração de texto/tabelas apropriada.
- PDF digitalizado: avaliar OCR, tratar baixa confiança e documentar dependências. Não tratar todos os PDFs como se precisassem de OCR.
- Não inventar escola, código, produto, unidade ou quantidade. Detectar ambiguidade e exigir confirmação.
- Tratar páginas, cabeçalhos repetidos, subtotais e totais sem duplicar os pedidos.
- Reaproveitar prévia, validação e confirmação segura do Excel.
- Não enviar documentos a serviços externos nem contratar serviços para OCR sem autorização específica.

Teste com exemplos fictícios. Já temos um exemplo em Excel, mas um PDF oficial pode ainda não estar anexado. Implementar e validar PDF com texto usando exemplos disponíveis e declarar quais layouts foram testados; OCR fica condicionado à necessidade concreta e à infraestrutura autorizada. Não adiar a correção do Excel esperando um PDF. Não declarar suporte universal ou compatibilidade com um PDF da prefeitura que não foi testado.

## 13. Romaneio escolar e horário da entrega

Preserve o romaneio individual por escola, inclusive para escolas no mesmo endereço.

O romaneio é o documento individual da escola, impresso em quatro cópias: uma para a escola, uma que volta com o caminhão e duas para o Departamento de Merenda Escolar. Mantenha um documento por entrega/evento, com opção simples de imprimir quatro cópias; não crie quatro entregas, quatro cobranças ou quatro históricos. Se identificar o destino de cada via, isso é somente apresentação. Não quadruplicar os arquivos do ZIP por padrão.

Incluir identificação do ciclo/escola/documento, produtos/unidades, pedido e campos claros para entrega bruta, rejeição e aceite, além de observação, nome de quem recebe e assinatura.

**Obrigatório: “Data da entrega: ____/____/______ | Horário da entrega: ____:____”.** É a hora real, preenchida na entrega, não a hora de impressão, importação ou salvamento. Esse espaço manual deve existir mesmo se a persistência digital do horário depender de Lucas. Quando disponível, registrar o horário real com data e fuso local apropriados, separando-o do horário de lançamento no sistema.

Antes da entrega, deixar a conferência em branco ou identificada como prevista; não imprimir valores como já recebidos automaticamente. Depois, os registros confirmados devem refletir o romaneio assinado. Complementos devem ser identificáveis sem alterar retrospectivamente o documento original como se toda a quantidade tivesse chegado de uma vez.

Não acrescentar assinatura digital certificada, geolocalização ou upload obrigatório de comprovantes nesta rodada.

## 14. PDFs semanais, ZIP e histórico

Preserve os sete tipos de documento e o ZIP existentes, ajustando os conteúdos às fontes corretas quando o novo fluxo estiver integrado.

- Selecionar o ciclo e baixar documentos de ciclos abertos e fechados conforme permissão.
- Repetir identificação do ciclo e cabeçalho das tabelas nas páginas seguintes; incluir paginação.
- Testar relatórios extensos com 191 escolas, nomes longos e produtos ativos.
- Manter separado pedido, recebimento, rejeição e aceite. Documento de “entregas às escolas” não pode usar pedido menos devolução como prova de recebimento efetivo sem avisar sobre o modelo antigo.
- Nomear arquivos de forma clara por ciclo e tipo; manter downloads individuais por tipo e ZIP.
- Aproveitar impressão existente. Informar se romaneios estão agrupados num PDF e quais opções individuais por escola realmente existem; não prometer recursos não implementados.
- Mostrar que valores do ciclo aberto podem mudar. Não reconstruir silenciosamente valores históricos com preços atuais.
- Cadastros desativados com movimentação histórica devem continuar aparecendo nas consultas, fichas, resumos e PDFs antigos.
- Preservar o aviso sobre dados cadastrais atuais quando ainda não houver versão histórica do cadastro. Não afirmar que todo documento é historicamente imutável se esse suporte não existir.

Ovos deve sair dos novos lançamentos conforme decisão já tomada, sem apagar histórico. A alteração dos dados no banco real continua reservada ao Lucas. Corrigir filtros e regras do aplicativo, testar histórico com Ovos e preparar a necessidade de desativação sem alterar seed ou banco real.

## 15. Interface simples e salvamento confiável

- Manter clara a sequência: pedido das escolas, pedido aos produtores, conferência do galpão, recebimento nas escolas, diferenças e fechamento.
- Evitar duplicação de digitação. Mostrar campos de ocorrência somente quando necessários.
- Melhorar largura dos nomes e manter identificadores visíveis ao rolar tabelas de produtos. Preservar o estilo atual.
- Corrigir campos que inicializam com `useState(initialValue)` e ficam desatualizados após importação ou troca de ciclo.
- Não sobrescrever silenciosamente uma edição local em andamento durante atualização.
- Diferenciar pendente de salvar, salvando, salvo e erro. Mensagens devem aparecer perto do campo/ação.
- Não incluir valores rejeitados pelo servidor como totais oficiais.
- Ao falhar a comunicação, manter a indicação de falha e permitir retomada segura, sem duplicar registros.

Mapa de Montagem faz parte desta série de etapas — ver Etapa 7 (seção 17.1), a ser executada só depois de validar o fluxo principal (núcleo de quantidades, importação, complementos). Gestão de usuários e tela de auditoria permanecem fora desta rodada; manter auditoria automática existente.

## 16. Integridade, concorrência e testes seguros

- Validar regras no servidor, independentemente da interface e do arquivo importado.
- Rejeição no galpão limitada à entrega bruta correspondente; rejeição na escola limitada à entrega real correspondente.
- Impedir redução de recebimento abaixo da rejeição já registrada, inclusive com duas pessoas editando ao mesmo tempo. Pedido escolar não substitui recebimento no novo modelo.
- Preserve correção de rejeição para zero, confirmação de entrega zero, preços congelados e auditoria transacional.
- Avaliar transações, controle de versão, isolamento ou travas compatíveis com o banco atual. Documentar o que depender de Lucas, sem assumir que apenas alteração de schema resolve concorrência.
- Impedir alterações indevidas em ciclo fechado e vazamento de dados entre ciclos.

Antes de qualquer teste destrutivo, comprovar que o destino é exclusivo e descartável. Nome contendo “test” sozinho não comprova isso. Não imprimir credenciais em mensagens de erro. Se não houver comprovação, não executar limpeza; usar testes de domínio/simulações e declarar a limitação.

Corrigir a documentação de backup: não usar a suíte que chama `resetDb()` para verificar uma restauração, pois ela apaga os dados recuperados. Verificar contagens, relacionamentos, registros e totais conhecidos sem mutações. Testes destrutivos usam outro banco.

Infraestrutura de backup e teste real de restauração continuam com Lucas. Documentar a necessidade de recuperar ciclos, pedidos, entregas, rejeições, complementos, preços/descontos históricos, custos e auditoria. PDFs não substituem backup.

## 17. Critérios de aceitação e ordem de execução

Ordem recomendada:
1. Ler specs anteriores, conferir branches e arquitetura, registrar specs/plano/regras e dependências com Lucas, integrar os commits atuais da develop na branch de trabalho e proteger testes antes de executá-los.
2. Formalizar e testar o núcleo de quantidades/responsabilidades e os estados de conferência/fechamento, documentando imediatamente dependências de Lucas. Não afirmar que a persistência nova está pronta.
3. Corrigir primeiro a importação de Excel no app com o exemplo GZ, atualização das telas, avisos/documentos e problemas independentes dentro do escopo autorizado. Preservar o fluxo atual e avisar onde a cobrança ainda usa o modelo antigo.
4. Implementar as partes independentes de leitura PDF, histórico, documentos e usabilidade. A integração do núcleo novo só pode ocorrer depois de Lucas fornecer o suporte e de existir alinhamento explícito para consumir a API; não criar um substituto improvisado em Prisma.
5. Validar o ciclo completo que estiver realmente integrado; atualizar specs, tarefas e relatório; integrar o conjunto validado na develop e confirmar o push. Documentar limites sem rotular dependências pendentes como concluídas.
6. Só depois do passo 5 validado: Mapa de Montagem (seção 17.1) — 191 escolas, rotas, paradas compartilhadas, previsto/embarcado/aceito.

Testes necessários:
- Exemplo 200 no pedido/galpão, 20 rejeitados no galpão, 180 apresentados à escola, 10 rejeitados, 170 aceitos: pagar produtor por 180; cobrar prefeitura por 170; falta 30; perda escolar 10.
- Complemento de 30 aceitos vindo de outro produtor: escola totaliza 200, fornecedor original mantém 180, novo fornecedor tem seu recebimento próprio; perda original de 10 permanece registrada. Não duplicar cobrança ou subtrair a perda duas vezes.
- Sem reposição: encerrar atendimento em 170 com falta final 30 registrada, sem gerar pendência ou cobrança no próximo ciclo.
- Entrega zero confirmada, recebimento não informado, pedido zero e ausência total de entrega.
- Pedido de 30 kg, complemento escolar aceito de 20 kg e recebimento inicial vazio: conferência pendente; confirmando zero inicial, falta de 10 kg.
- Ciclo vazio; recebimento não conferido; valores calculados com faltas sem decisão; falta formalmente encerrada; erro real. O estado “pronto para fechar” só aparece quando todas as condições operacionais forem satisfeitas.
- Zero explícito deve atualizar 20 para 0; vazio não apaga; coluna repetida exige decisão; `1.000` textual exige tratamento da ambiguidade; código igual com escola divergente exige revisão.
- GZ com várias abas e cabeçalhos Pedido/Entrega, produtos fora da oferta, colisões de código e precisão maior que a suportada: confirmar exclusões e totais, sem criar entregas ou decisões fictícias.
- Correção de rejeição para zero e tentativa de reduzir recebimento abaixo da rejeição, inclusive concorrência.
- Perda antes de chegar à escola separada de rejeição escolar; falta não vira perda automaticamente.
- Excesso de uma escola/produto sem compensar a falta de outro.
- Correção de quantidade sem alterar preço/desconto histórico; valores consistentes entre tela, PDF e balanço.
- Importações com zero, vazio, duplicados, números ambíguos, unidades, erros, várias abas, cabeçalhos e páginas repetidos, falha na gravação e reenvio.
- Atualização da tela após importação, troca de ciclo, erro de salvamento e recarregamento.
- Cadastros inativos e Ovos no histórico; dados antigos sem entrega real não convertidos automaticamente.
- PDFs e ZIP de ciclo aberto, fechado e histórico; volume de 191 escolas; impressão de quatro cópias sem multiplicação de dados; data e horário real da entrega.
- Antes de qualquer integração futura com a API Java: identidade/permissões, vínculo de organização, IDs, eventos, preço histórico, validação de devolução, concorrência e resultado financeiro devem reproduzir os mesmos critérios de negócio.
- Se todo o núcleo estiver integrado: pedido → divisão/pedido aos produtores → recebimento galpão → rejeição galpão → entrega escolar → rejeição escolar → complemento ou falta encerrada → resumo → diferenças → documentos → fechamento.

Use dados fictícios. Não alterar dados reais para demonstrar testes. Diferencie testes unitários, dependências simuladas, banco isolado, interface e inspeção visual de PDFs. Testes antigos passando não comprovam os novos fluxos.

## 17.1. Etapa 7 — Mapa de Montagem (só depois de validar o núcleo)

Execute esta etapa depois que pedidos, galpão, escola, complementos e financeiro estiverem funcionais e testados, não antes. Leia `controle_escolas_produtores_2026_MODELO_v20.xlsx` como referência de números e sequência; não invente dados ausentes.

Confirme na planilha e depois no app:
- 191 escolas no total; 100 na segunda-feira e 91 na terça-feira;
- 18 rotas (S1 a S10 na segunda, T1 a T8 na terça);
- 180 paradas físicas — 191 escolas, mas algumas compartilham endereço, então há 11 pares na mesma parada.
- Galpão de Itaipava é o ponto de início e fim de cada rota, não uma escola: não o conte como parada nem gere pedido/romaneio para ele.

Escolas no mesmo endereço compartilham a parada física de carregamento, mas mantêm pedido, recebimento, rejeição e romaneio **completamente separados** — nunca some ou confunda os documentos das duas só porque a parada é uma.

Por rota, mostrar: sequência de escolas, produtos e quantidades previstas (vindas do pedido, não digitadas de novo), peso previsto (some só os produtos da oferta ativa — Ovos fica fora do peso, mesma regra do restante do app), veículo e motorista.

No app, além do previsto, registre a **carga efetivamente embarcada** por produto, vinculada às entregas da rota. Mantenha as três informações visivelmente distintas e nunca combinadas num único número:
- **Previsto**: soma dos pedidos das escolas da rota;
- **Embarcado**: o que realmente saiu do galpão naquele veículo, registrado na hora da carga;
- **Aceito escolar**: o que cada escola de fato confirmou depois, já coberto pelo núcleo da Etapa 2.

Embarcar não confirma recebimento nem gera cobrança — é só rastreio de logística. Se o embarcado divergir do previsto (por exemplo, uma falta que não foi coberta a tempo), mostre a diferença sem escondê-la nem ajustá-la automaticamente para bater com o previsto.

Preserve os vínculos com complementos: se uma reposição sair em outra viagem depois da rota original, ela precisa ter sua própria carga/embarque registrado, sem se misturar com o embarque da carga inicial nem duplicar a distribuição da escola. Não implemente otimização automática de rotas ou sequência — a ordem das paradas é a que já está confirmada na planilha; o app organiza e mostra, não decide.

Teste antes de considerar a etapa concluída:
- As 191 associações escola↔rota↔parada, conferidas contra o MODELO;
- Uma rota de segunda e uma de terça, do início ao fim;
- Uma parada compartilhada (os dois documentos saem separados, os dois pedidos não se misturam);
- Um caso de divergência entre previsto e embarcado (por exemplo, um produtor que faltou);
- Uma reposição por outra viagem depois do embarque original, sem duplicar a distribuição da escola;
- A impressão de pelo menos uma rota de cada dia: legibilidade, quantidades, peso previsto e campos de veículo/motorista.

Depois de embarque e entregas passarem a existir de verdade, reteste os vínculos com o financeiro e o fechamento: uma rota com carga pendente de conferência não pode deixar a semana parecer pronta para fechar.

## 18. Relatório, Git e retomada

Ao concluir cada etapa e antes de interromper:
- Atualize as specs, seus planos/tarefas, o índice/backlog, `docs/plano-de-implementacao.md`, `memory.md`, propostas pendentes e `docs/relatorio-sessao.md`. Mantenha referências entre os documentos, sem espalhar versões contraditórias da mesma regra.
- Escreva para um humano entender: o que mudou, por que, onde clicar, como testar e o que ainda não funciona.
- Separe “implementado e testado”, “implementado mas não validado”, “preparado sem integração” e “bloqueado por dependência do Lucas/arquivo real”.
- Não declare todas as etapas concluídas quando alguma apenas ganhou documentação.
- Liste alterações financeiras, fontes de quantidade e preservação do histórico.
- Informe branches, commits enviados, commit de integração na develop e resultado efetivo de cada push. Diferencie o que está somente local, o que está na branch de trabalho e o que já chegou à develop. Se a integração estiver bloqueada, explique a causa e preserve o progresso.
- Deixe o próximo passo exato, arquivos envolvidos, bloqueios e verificações ainda necessárias.
- O plano deve conter uma lista única com estado de cada etapa. Guarde o prompt autorizado completo no repositório e faça os registros de progresso durante a execução, antes de esgotar a sessão.
- O relatório deve indicar expressamente se ainda existe dependência de schema/API do Lucas. “Regra testada em memória” não significa “entrega por escola implementada”.
- Resuma em português simples o que o Lucas precisa implementar ou revisar, com referência aos arquivos e aos testes de aceitação. Não envie mensagens para ele automaticamente.

Continue automaticamente pelas etapas independentes dentro da sessão. Faça commits por etapa coerente, sem commits artificiais por cada arquivo. Não sobrescreva trabalho do colaborador e não misture alterações alheias no seu commit. Se o push falhar, informe em vez de dizer que está salvo no GitHub.

O resultado desejado é um aplicativo simples, com uma única entrada para cada informação, no qual o produtor recebe pelo aprovado no galpão, a prefeitura paga pelo aceito na escola e as perdas da cooperativa ficam visíveis sem apagar nem distorcer os registros.


## 19. Como retomar depois de uma interrupção

Mensagem de retomada sugerida ao usuário:

> Leia `specs/README.md`, as specs/plans/tasks relevantes, o prompt autorizado, `docs/plano-de-implementacao.md`, `memory.md` e `docs/relatorio-sessao.md`. Confira branches, commits locais/remotos, alterações não commitadas e o que já foi integrado na develop. Continue do próximo passo realmente pendente. A integração e o push na develop estão autorizados após validação; preserve as restrições de banco/API, main, staging e produção. Não refaça etapas nem merges concluídos. Compare novos commits do Lucas e mantenha as specs e o relatório atualizados.

Se algum documento ou anexo faltar, informe exatamente qual. Não presuma ter memória ou acesso a arquivos de uma sessão anterior. Avance nas tarefas independentes disponíveis e registre os bloqueios, sem marcar um trabalho incompleto como finalizado.
