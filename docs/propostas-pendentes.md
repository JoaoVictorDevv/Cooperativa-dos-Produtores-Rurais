# Propostas pendentes — decisões de banco e operacionais

Este documento reúne as seções do plano (`docs/plano-de-implementacao.md`)
que exigem uma decisão do usuário e/ou uma mudança de schema/infraestrutura
reservada ao olucasgon, e que por isso **não foram implementadas** nesta
sessão — só analisadas e documentadas, conforme pedido explicitamente
("continue em outra tarefa independente... documente a proposta").

Nenhum item aqui envolve código pronto pra aplicar sem decisão prévia.
Onde uma mudança de schema é sugerida, ela é uma sugestão de formato, não
uma migração já escrita.

---

## 1. Entrega efetiva por escola (plano §8)

**Problema real, com exemplo do próprio plano**: hoje o sistema sabe
quanto uma escola *pediu* (`SchoolOrder`) e quanto foi *devolvido*
(`SchoolReturn`), mas não sabe quanto ela **realmente recebeu**. Se uma
escola pediu 20 kg e só chegaram 15 kg (falta de 5 kg, não devolução),
isso não tem onde ser registrado hoje. Devolução e falta são conceitos
diferentes: devolução é "chegou e foi rejeitado"; falta é "não chegou".

**Por que isso importa**: sem isso, alguém pode ser tentado a "forçar" o
sistema lançando uma devolução de 5 kg pra representar a falta — o que é
exatamente o que o plano pede pra NÃO fazer ("não usar devolução para
esconder uma entrega parcial"), porque contamina os relatórios de
devolução (motivo, produtor associado) com algo que não é devolução.

**Proposta de formato (não implementada)**: adicionar um conceito de
"entrega efetiva por escola", por semana+escola+produto, com pelo menos:
- quantidade efetivamente entregue (distinta de pedido e de devolução);
- uma forma de marcar "ainda não conferido" que seja diferente de "zero
  confirmado" — mesmo princípio já corrigido nesta sessão pra entrega de
  produtor (Etapa 1, §4B), aplicado agora do lado da escola;
- quantidade não entregue = pedido − entregue (derivada, não digitada);
- um jeito de vincular uma reposição futura ao pedido original, sem
  contar a quantidade duas vezes (nem na semana da falta, nem na semana
  da reposição, mais que uma vez).

**Opções de schema a avaliar com o olucasgon** (nenhuma escolhida ainda):
- (A) Uma tabela nova `SchoolDeliveryLine` (semana+escola+produto+qtd
  entregue), paralela a `SchoolOrder`/`SchoolReturn`, seguindo o mesmo
  padrão de tabelas separadas já usado no resto do schema.
- (B) Estender `SchoolDelivery` (hoje só tem dia/data por escola, sem
  quantidade por produto) pra ter linhas por produto — mistura conceitos
  diferentes (confirmação de dia vs. quantidade por produto) e por isso
  parece pior opção, mas fica registrada.
- Reposição: provavelmente um campo `relatedOrderId`/`repositionOfId` ou
  uma tabela de vínculo, apontando pro pedido original — pra somar "o que
  a escola recebeu no total" sem contar a reposição como um pedido novo
  independente.

**Não implementado**: esquema exato, migração, telas de lançamento. Fica
como a base de discussão pro próximo ciclo com o olucasgon e o usuário.

---

## 2. Cobrança e fechamento com faltas (plano §9)

**Regra atual, preservada**: o valor cobrado da prefeitura é sempre
`(pedido − devolução) × preço`, por escola e produto — implementado em
`schoolValue()`/`treasuryTotal()` (`src/lib/calc.ts`) e coberto por
testes automatizados. **Isso não foi alterado nesta sessão** e não deve
ser alterado sem a decisão abaixo, porque hoje o "pedido" é usado como
proxy de "atendido" — o que só deixa de ser verdade quando existir
entrega efetiva por escola (item 1 acima).

**Decisões que faltam tomar** (o usuário e a cooperativa, não é uma
decisão técnica):
1. Quando existir uma falta confirmada (ver item 1), a cobrança da
   prefeitura continua sendo sobre o pedido, ou passa a ser sobre o que
   foi de fato entregue? Isso muda o valor cobrado pra menos em semanas
   com falta — impacto financeiro direto, precisa de decisão explícita,
   não de uma mudança de fórmula silenciosa.
2. Uma falta justificada (ex.: problema de transporte) permite fechar a
   semana normalmente, ou o fechamento deveria ficar bloqueado até a
   falta ser resolvida (repor ou formalmente descartar)?
3. Se a falta for resolvida por reposição **em outra semana**, como isso
   aparece no histórico da semana original (que já está fechada) sem
   reabri-la e sem alterar valores/documentos já emitidos daquela semana?

**Enquanto isso não é decidido**: a regra `pedido − devolução` continua
valendo exatamente como está — não é uma lacuna, é a regra vigente até
haver uma decisão explícita de mudá-la.

---

## 3. Pedidos de semanas futuras (plano §14)

**Restrição atual**: só pode haver uma `Week` com `status = ABERTA` por
vez (regra reforçada pelo olucasgon em `weekPolicy.ts` e no schema). Isso
significa que não dá pra começar a receber o pedido da próxima semana
enquanto a atual ainda está em operação — a cooperativa fica sem essa
folga de planejamento.

**Proposta a avaliar com o olucasgon** (schema, não implementado): um
novo status intermediário pra `Week`, algo como `PLANEJAMENTO`, que:
- permite lançar `SchoolOrder`/`ProducerOrder` pra essa semana futura
  desde já, sem contar pra nenhum total financeiro ainda;
- não conta como a "semana aberta" pra fins de `weekPolicy.ts` (a
  semana ABERTA de verdade continua sendo só uma);
- vira ABERTA de verdade só quando a semana anterior fecha (uma
  transição controlada, não uma segunda semana aberta simultânea).

Isso exigiria alterar o enum `WeekStatus` no schema
(`ABERTA | FECHADA` → `PLANEJAMENTO | ABERTA | FECHADA`) e revisar toda
lógica que hoje assume só duas possibilidades — mudança de schema e de
regra de negócio importante o bastante pra ser do olucasgon decidir o
formato, não só aplicar.

**Não implementado**: nenhuma mudança de schema, nenhum novo status.

---

## 4. Retirada de Ovos do fluxo ativo (plano §15)

**O que já foi preparado nesta sessão (código, sem tocar em dado real)**:
o fluxo de importação de Excel (Etapa 5) já reconhece um produto
desativado pelo nome (ex.: "Ovos") numa planilha importada e avisa
explicitamente "esse produto não é mais atendido pelo fluxo ativo" — em
vez de tratar a coluna como desconhecida/erro genérico. Ver
`src/lib/importSchoolOrders.ts` (campo `inactiveProductColumns`) e o
teste correspondente em `importSchoolOrders.test.ts`.

**O que falta pra decisão completar isso**: o produto `Ovos` já tem um
campo `active` no schema (nenhuma migração necessária!) — desativá-lo é
literalmente `UPDATE products SET active = false WHERE slug = 'ovos'`,
uma operação de dado normal, não de schema. Isso automaticamente:
- tira Ovos das telas de pedido/entrega (`escolas`, `produtores`), que já
  filtram por `active: true`;
- **preserva** todo o histórico já lançado (semanas antigas com Ovos
  continuam corretas nos relatórios, PDFs, Diferença — nenhuma dessas
  telas filtra por `active`, só pelas linhas que já existem na semana);
- é revertível (só voltar `active` pra `true`).

**Por que não fiz essa mudança de dado eu mesmo**: essa é uma operação no
banco real da cooperativa (não no meu ambiente local de testes) — o
plano pede explicitamente pra coordenar mudanças de dado/banco com o
olucasgon, mesmo quando é "só" um `UPDATE` sem schema novo. Fica pronta
pra ser aplicada assim que combinado.

---

## 5. Backup (plano §16)

**O que existe hoje**: nada de backup automatizado foi encontrado no
repositório — nem script, nem configuração, nem documentação prévia.
Cada ambiente de desenvolvimento (o meu, o do olucasgon) tem seu próprio
Postgres local, sem replicação nem exportação agendada. **Isso não é
crítico enquanto o app está em fase de teste com dados fictícios**, mas
vira crítico antes de qualquer piloto com dados reais.

**Requisitos levantados a partir do próprio plano**:
- Precisa recuperar TODOS os dados da operação semanal, **incluindo uma
  semana ainda aberta** (não só semanas fechadas/históricas).
- PDFs e histórico dentro do próprio banco **não substituem** backup —
  se o banco cair, os PDFs não recriam os dados de uma semana aberta que
  ainda não foi fechada.

**Proposta pra alinhar** (nada disso foi configurado):
- **Armazenamento**: se o deploy final for Postgres gerenciado (Neon foi
  mencionado no início do projeto), a maioria dos provedores gerenciados
  já oferece snapshot automático — precisa confirmar qual plano/provedor
  e ativar explicitamente, não assumir que "vem de graça".
- **Frequência**: diário deveria ser o mínimo, considerando que a
  operação é semanal — um backup diário cobre o pior caso (perder no
  máximo um dia de lançamentos).
- **Retenção**: sugestão inicial de 30 dias rolantes + um backup mensal
  guardado por mais tempo (ex.: 1 ano), mas isso é decisão de custo/risco
  da cooperativa, não técnica.
- **Teste de restauração**: a única forma de saber se um backup funciona
  é restaurá-lo de verdade, num banco separado (nunca por cima do banco
  real), e rodar a suíte de testes de integração (`npm run
  test:integration`, já com a proteção de banco-de-teste desta sessão)
  contra ele pra confirmar que os dados restaurados fazem sentido.

**Não implementado**: nenhuma infraestrutura de backup real, nenhum
script de restauração. Isso depende de decisões de provedor/custo que
não são técnicas.

---

## 6. Divisão → Pedido aos produtores sem redigitar (plano §17)

**Observação**: hoje `ProducerAllocation` (divisão planejada) e
`ProducerOrder` (pedido efetivo) são tabelas independentes de propósito
— e devem continuar sendo, pra manter planejamento e pedido efetivo
conceitualmente separados (regra absoluta do projeto). Na prática,
porém, quando a divisão já reflete o que vai ser pedido, o operador
acaba digitando a mesma quantidade duas vezes (uma vez em "Divisão",
outra em "Pedido").

**Proposta a avaliar** (nenhuma implementação ainda, por depender de
confirmação do fluxo real com o usuário): uma ação explícita tipo
"Confirmar divisão e gerar pedidos", que:
- mostra uma prévia (produtor × produto × quantidade da divisão) antes
  de aplicar — nunca silenciosa;
- copia os valores de `ProducerAllocation` pra `ProducerOrder` só pra
  quem ainda não tem pedido lançado naquele produto (não sobrescreve um
  pedido já digitado manualmente, pra não perder ajuste feito à mão);
  quem já tem pedido lançado fica de fora da cópia — o operador ajusta
  esses manualmente se precisar mudar algo lá;
- **nunca** toca em `ProducerDelivery` (entrega real) — essa ação é só
  sobre planejamento → pedido, entrega continua sendo lançada à parte,
  sempre.

**Por que não implementei já**: o comportamento exato de "o que fazer
quando já existe um pedido diferente da divisão" precisa de confirmação
do usuário (sobrescrever? avisar e pular? deixar escolher por linha?) —
implementar às cegas arriscaria um comportamento que apaga um ajuste
manual sem querer. Fica como proposta pronta pra construir assim que
confirmado.

---

## Resumo — o que cada um decide

| Item | Quem decide | Bloqueia o quê |
|---|---|---|
| 1. Entrega efetiva por escola | Usuário (regra de negócio) + olucasgon (schema) | Cobrança com faltas (item 2), indicadores de atendimento (plano §11) |
| 2. Cobrança com faltas | Usuário/cooperativa | Nada tecnicamente — regra atual continua valendo até decidir |
| 3. Semanas futuras | olucasgon (schema) + usuário (fluxo) | Nada urgente — só conveniência operacional |
| 4. Retirar Ovos | Usuário (confirma) + olucasgon (aplica o UPDATE no banco real) | Nada — código já preparado, só falta aplicar o dado |
| 5. Backup | Usuário (custo/provedor) + olucasgon (infra) | Qualquer piloto com dados reais |
| 6. Divisão → Pedido | Usuário (confirma o comportamento) | Nada — é conveniência, não correção |
