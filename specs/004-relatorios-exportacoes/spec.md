# Especificação 004 — Relatórios e documentos do ciclo (PDF/ZIP e romaneio)

**Status:** implementada e testada no modelo atual de dados. Os conteúdos que
dependem de entrega por escola/produto (spec 008) continuam com a metodologia
antiga, **identificada nos documentos**. Etapa 5 (26/09/2026): os mesmos tipos
de documento pela lógica corrigida (RD-11 a RD-14) estão prontos e testados a
partir do registro do ciclo, **usados só na demonstração** até existir a
persistência — ver `docs/propostas-pendentes.md` §10.

**Origem:** candidato SPEC-004 do `backlog.md`, promovido na Rodada 2.
**O que já existia:** a Rodada 1 criou os 7 documentos em PDF e o ZIP por
semana (`src/lib/pdf/*`, rotas `/api/semanas/[weekId]/pdf/*`). Esta spec não
os recria: registra as regras e corrige o que o prompt v2 (§13, §14) exige.

## Documentos

| Tipo | Conteúdo | Fonte atual |
|---|---|---|
| Pedido das Escolas | escola × produto × pedido | `SchoolOrder` |
| Pedidos aos Produtores | produtor × produto × pedido | `ProducerOrder` |
| Romaneios das Escolas | um romaneio por escola (página própria) | `SchoolOrder` (+ devolução lançada, como registro do sistema) |
| Recebimento e Devoluções no Galpão | bruto, rejeição, aceito, a pagar | `ProducerDelivery`/`ProducerReturn` |
| Entregas às Escolas | só o dia de atendimento | `SchoolDelivery` — **aviso de modelo antigo** |
| Relatório de Diferenças | pedido das escolas × aceito no galpão, por produto | cálculo da Diferença do galpão |
| Balanço Financeiro | a cobrar, a pagar, margem, custos, resultado calculado | `getWeekFinancialSummary` — **nota de metodologia** |

## Regras

- **RD-01 Ciclo selecionável**: qualquer ciclo (aberto, fechado, antigo) pela
  página da semana (`/semanas/[id]`). Mesma permissão para arquivo e ZIP
  (usuário autenticado).
- **RD-02 Identificação em todas as páginas**: cooperativa, documento, ciclo
  (número e datas) e situação (aberto/fechado) repetidos; cabeçalho da tabela
  repetido; "Página X de Y".
- **RD-03 Ciclo aberto**: aviso de que os valores podem mudar.
- **RD-04 Nomes de arquivo**: `semana-<n>-<AAAA-MM-DD>-<tipo>.pdf`; ZIP
  `semana-<n>-<AAAA-MM-DD>-documentos.zip`, com uma via de cada documento.
- **RD-05 Romaneio** (referência: MODELO v20, abas por escola):
  - um documento por escola/código, inclusive escolas no mesmo endereço;
  - identificação do documento (`S<ciclo>-<código>`), ciclo, escola (nome,
    código, bairro, endereço, telefone);
  - produtos com unidade (kg/dz) e pedido; colunas **Entregue (bruto)**,
    **Rejeitado**, **Aceito** e **Motivo/observação em branco**, para
    preencher na entrega — nunca impressas como se já tivessem sido
    recebidas;
  - linha obrigatória **"Data da entrega: ____/____/______ | Horário da
    entrega: ____:____"** (hora real, não a de impressão ou lançamento);
  - observações, nome legível de quem recebeu, assinatura, e quem entregou
    pela cooperativa;
  - devolução já lançada no sistema aparece separada, como "registro do
    sistema (modelo atual)";
  - complementos usam romaneio próprio (quando existirem — spec 008), sem
    alterar o original.
- **RD-06 Quatro vias**: opção de impressão (`?vias=4`) com destino de cada
  via (Escola; Retorna com o caminhão; 2× Departamento de Merenda Escolar).
  É só apresentação: não cria entregas, cobranças ou históricos, e o ZIP não é
  quadruplicado.
- **RD-07 Romaneio individual**: na ficha da escola, "Romaneio desta escola
  (PDF)" e "4 vias (PDF)" (`?escola=<código>`). "Romaneios das Escolas" reúne
  todas as escolas num só PDF, uma página por escola.
- **RD-08 Separação de conceitos**: pedido, recebimento, rejeição e aceite não
  se misturam. "Entregas às Escolas" avisa que não comprova quantidade. O
  Balanço traz a metodologia usada (pedido − devolução para a cobrança) e usa
  "A cobrar", "A pagar" e "Resultado calculado" (não quitação).
- **RD-09 Histórico**: preços/descontos congelados no lançamento; cadastros
  desativados (ex.: Ovos) continuam aparecendo em ciclos que os têm. Nomes e
  endereços vêm do cadastro atual (aviso no rodapé — não há versão histórica
  do cadastro).
- **RD-10 Datas**: datas de ciclo em UTC (como gravadas); hora de emissão no
  fuso de Petrópolis (America/Sao_Paulo).
- **RD-11 Fonte por metodologia**: os sete tipos e os nomes de arquivo não
  mudam; a fonte do conteúdo é escolhida pela metodologia do ciclo
  (`DOCUMENT_SOURCES`). Ciclos no modelo antigo continuam com os documentos
  atuais para sempre; "Pedidos aos Produtores" não muda de fonte.
- **RD-12 Romaneio de complemento**: cada complemento (ou grupo de
  complementos da mesma escola com a mesma data/hora real) tem documento
  próprio `<ciclo>-<escola>-C<n>`, com pedido original, aceito antes,
  entregue/rejeitado/aceito agora e origem. O romaneio da entrega inicial nunca
  é alterado. Previsto = conferência em branco; registrado = "cópia conforme
  registro", com data/horário real quando registrados.
- **RD-13 Entregas e atendimento**: por escola/produto — pedido, entregue,
  rejeição da escola, perda antes da escola, aceito, falta, excedente e
  situação em texto; pendente de conferência nunca vira zero; totais e
  atendimento por unidade (cada linha conta no máximo o próprio pedido); falta
  total só de linhas conferidas.
- **RD-14 Diferenças e balanço no novo modelo**: diferença com "saldo a
  conferir" (não é estoque nem perda); balanço a cobrar pelo aceito na escola e
  a pagar pelo aceito no galpão, com os três indicadores, bloqueios e faltas
  encerradas.

## Critérios de aceite

- **CA-004.1** Os 7 documentos e o ZIP abrem para ciclo aberto e fechado.
- **CA-004.2** Página 2 em diante repete ciclo e cabeçalho da tabela; todas
  numeradas.
- **CA-004.3** Romaneio com conferência em branco, linha de data/horário,
  nome e assinatura; 4 vias identificadas; individual por escola.
- **CA-004.4** 191 escolas: todos os documentos gerados; ZIP em tempo
  aceitável (medido: ~11 s).
- **CA-004.5** Ciclo fechado sem aviso de "aberto"; Ovos aparece no histórico
  mesmo depois de desativado.
- **CA-004.6** Balanço com nota de metodologia; Entregas às Escolas com aviso
  de modelo antigo.

## Fora de escopo

- Arquivar o PDF emitido (versão "assinada" imutável) — exigiria storage.
- Versão histórica do cadastro de escolas/produtores.
- Romaneio de complemento e documentos com aceite real por escola — dependem
  da spec 008 (persistência do Lucas).
