# Especificação 001 — Integridade operacional

**Status:** implementada e verificada em PostgreSQL isolado  
**Objetivo:** tornar o ciclo semanal seguro para um piloto real, impedindo estados financeiros ambíguos e mantendo toda alteração crítica auditável.

## Cenários de usuário

### US-01 — Criar uma semana coerente (prioridade P1)

Como operador, quero cadastrar uma semana com datas coerentes para que todos os lançamentos pertençam ao período correto.

Critérios de aceite:

- **CA-01.1:** a data inicial não pode ser posterior à data final;
- **CA-01.2:** a data de referência deve estar entre a data inicial e a final, inclusive;
- **CA-01.3:** o banco deve impedir mais de uma semana aberta, mesmo com duas requisições simultâneas.

### US-02 — Registrar uma única devolução por origem e produto (P1)

Como operador, quero corrigir uma devolução existente sem criar linhas duplicadas para que o financeiro permaneça determinístico.

Critérios de aceite:

- **CA-02.1:** existe no máximo uma devolução por semana, escola e produto;
- **CA-02.2:** existe no máximo uma devolução por semana, produtor e produto;
- **CA-02.3:** salvar novamente atualiza a devolução existente;
- **CA-02.4:** os resumos somam dados legados duplicados de forma defensiva até a migração ser aplicada.

### US-03 — Fechar somente uma semana concluída (P1)

Como responsável pela operação, quero ser avisado e impedido de fechar uma semana com entregas pendentes para não congelar um balanço incompleto.

Critérios de aceite:

- **CA-03.1:** pedido positivo a produtor sem entrega correspondente bloqueia o fechamento;
- **CA-03.2:** escola com pedido positivo sem confirmação de entrega bloqueia o fechamento;
- **CA-03.3:** a interface apresenta a quantidade de pendências e mantém a semana aberta;
- **CA-03.4:** uma semana sem essas pendências pode ser fechada normalmente.
- **CA-03.5:** o banco rejeita lançamentos iniciados depois do fechamento e serializa lançamentos concorrentes com o fechamento.

### US-04 — Manter mutação e auditoria indivisíveis (P1)

Como administrador, quero que alterações críticas e seus registros de auditoria sejam confirmados juntos para que nunca exista mudança sem rastreabilidade.

Critérios de aceite:

- **CA-04.1:** se a auditoria falhar, a alteração de negócio também é revertida;
- **CA-04.2:** criação, fechamento e reabertura de semana são atômicos;
- **CA-04.3:** lançamentos de pedido, divisão, entrega, devolução, custo e preço são atômicos.

### US-05 — Calcular o acumulado PNAE pelo período operacional (P1)

Como responsável financeiro, quero que uma devolução pertença ao mesmo ciclo da entrega correspondente, independentemente do dia em que foi digitada.

Critérios de aceite:

- **CA-05.1:** entregas entram no ciclo conforme sua data operacional;
- **CA-05.2:** devoluções são associadas às semanas dessas entregas, não ao `createdAt` da digitação;
- **CA-05.3:** várias devoluções legadas da mesma linha são somadas defensivamente.

### US-06 — Inicializar produção sem credenciais frágeis (P1)

Como administrador, quero que o carregamento inicial exija credenciais explícitas em produção para evitar uma conta conhecida publicada por engano.

Critérios de aceite:

- **CA-06.1:** em produção, email e senha do administrador são obrigatórios;
- **CA-06.2:** a senha nunca é impressa no terminal;
- **CA-06.3:** a senha inicial deve ter no mínimo 12 caracteres.

## Fora de escopo deste incremento

- importação da planilha por interface;
- exportação de relatórios;
- gestão de usuários;
- múltiplas cooperativas;
- alteração de limites ou regras regulatórias do PNAE.

Esses itens exigem especificações próprias e validação com os responsáveis da cooperativa.

## Adendo 2026-09 — o que mudou depois desta spec

- **CA-03.1 e CA-03.2** (fechar quando existe registro de entrega) continuam
  valendo como mínimo técnico, mas **não representam** mais o fechamento
  correto: a regra confirmada exige aceite por escola/produto, complementos e
  decisão sobre faltas. Ver
  [`008-recebimentos-faltas-fechamento`](../008-recebimentos-faltas-fechamento/spec.md)
  (CA-008.5). A troca depende de persistência nova (Lucas).
- **Devolução única por origem/produto (US-02)** continua valendo para o
  modelo atual. No novo modelo, a rejeição escolar é limitada pela entrega
  real daquele evento, não pelo pedido (CA-008.6).
- **Testes seguros (T09 → T10)**: o nome `colheita_test` sozinho **não**
  comprova que o banco é descartável. Desde 26/09/2026 os testes destrutivos
  só rodam por `npm run test:integration`
  (`scripts/run-integration-tests.mjs`), que cria um banco **novo** com nome
  único (`colheita_descartavel_<data>_<aleatório>`) no servidor local indicado
  em `.env.test` (o banco citado lá não é usado), grava nele uma marca com um
  código aleatório desta execução, aplica as migrações existentes, roda os
  testes e apaga o banco no fim. O teste (`src/lib/testing/disposableDb.ts`)
  só limpa tabelas depois de conferir no próprio banco a marca com o mesmo
  código; servidor não local é recusado (salvo `COLHEITA_TEST_ALLOW_REMOTE=1`)
  e nenhuma mensagem imprime a URL.
- **Backup**: a suíte de integração chama `resetDb()` e **apaga** os dados;
  nunca usá-la para verificar uma restauração. Ver `docs/propostas-pendentes.md` §5.
