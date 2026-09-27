# Atualização da planilha-modelo: MODELO v20 → MODELO v22

**Data:** 27/09/2026. **Arquivo:** `controle_escolas_produtores_2026_MODELO_v22.xlsx`
(nesta pasta).

A **MODELO v22** é a **referência oficial** da planilha e substitui a MODELO
v20. A v20 nunca foi versionada: era um anexo do prompt v2. A
`controle_escolas_produtores_2026_v35.xlsx`, da Rodada 1 (outra linha de
versões), foi retirada desta pasta em 27/09/2026. Só a v22 vale.

**É um modelo vazio.** Conferido célula por célula:

- nenhum resultado de fórmula guardado;
- nenhum pedido, entrega, devolução ou custo digitado;
- os únicos números digitados são:
  - os preços (linha 2 da "Entrada de Dados", repetidos em "LISTAS DE APOIO");
  - os códigos de MOTIVO;
  - a ordem das paradas no MAPA DE MONTAGEM;
  - as capacidades do MAPA DE PRODUÇÃO.

Planilha com pedido real ou com simulação **não** entra no repositório.

A comparação abaixo foi feita célula por célula e fórmula por fórmula entre a
v20 e a v22, cobrindo as 225 abas nas duas versões, inclusive as áreas de
impressão.

---

## 1. O que mudou

### 1.1 Fichas de produtor ("PROD - …", as 22 abas)

| Coluna | v20 | v22 |
|---|---|---|
| B | Pedido (kg), vem da Entrada de Dados | igual |
| C | Entrega (kg), vem da Entrada de Dados | igual |
| D | Devolução (kg), **digitada na ficha** | igual |
| E | Preço líquido `= preço − 3,67` | **Aceito (kg) `= C − D`** (entrega − devolução) |
| F | Valor a pagar `= (C − D) × E` | Preço líquido `= preço − 3,67` |
| G | Cód. motivo (oculta) | **Valor a pagar `= E × F`** |
| H | Motivo da devolução (oculta) | Cód. motivo (oculta) |
| I | — | Motivo da devolução (oculta) |
| Total | `F25 = SOMA(F6:F24)` | `G25 = SOMA(G6:G24)` |

Ajustes de impressão nessas abas:

- a área de impressão passa de `A1:H31` para `A1:I31`;
- as colunas de nome ficam mais largas (20 → 24);
- o nome e o telefone do produtor ocupam `B:G`;
- "Horário" vai para F28;
- o link "Voltar ao Índice" vai para J1, fora da impressão.

### 1.2 Referências que acompanharam a troca de colunas

- **RESUMO** (C75 em diante, motivos de devolução no galpão): o `SOMASE`
  agora lê o código do motivo na coluna H (antes, G).
- **BALANÇO FINANCEIRO** (B26 em diante, a pagar por produtor): agora lê
  `G25` de cada ficha (antes, `F25`).

### 1.3 Índice: passo a passo

O passo 2 foi corrigido. A ficha do produtor já mostra **Pedido e Entrega,
que vêm sozinhos da Entrada de Dados**. A quantidade entregue se digita no
bloco ENTREGA PRODUTORES (passo 3). **Na ficha do produtor só se digita a
Devolução**, quando o galpão rejeita algo.

Na v20, o texto mandava "digitar Entrega e Devolução" na ficha, e isso
contradizia a fórmula da própria ficha.

As orientações "Onde registrar cada rejeição" e "Complemento: primeira carga
ou outra viagem" (linhas 32 a 35) têm o mesmo texto da v20. A v22 só ajustou
o alinhamento e a quebra de linha do título da linha 34 para que apareçam
inteiras.

### 1.4 COMPLEMENTOS

O comprovante de entrega à escola (P17:T17) trocou o texto por
"— (já pago no recebimento no galpão)". Na v20 era "— (não gera pagamento; já
contado no recebimento no galpão)". A fórmula continua a mesma.

### 1.5 Fichas de escola: só impressão

Nas fichas de escola, o cabeçalho da tabela (linha 8) ficou mais alto
(33,75 → 46), para os títulos não cortarem na impressão. Nenhum texto ou
fórmula mudou.

### 1.6 O que **não** mudou

- Nenhuma aba entrou ou saiu.
- Entrada de Dados, DIFERENÇA, MAPA DE MONTAGEM, MAPA DE PRODUÇÃO, MOTIVO,
  LISTAS DE APOIO e as fórmulas das fichas de escola estão iguais.
- **A lógica financeira é a mesma.** O valor a pagar continua
  `(entrega − devolução) × (preço − 3,67)`. A v22 só mostra o passo
  intermediário ("Aceito") numa coluna própria.

---

## 2. v22 × o que o app já faz

Situação em 27/09/2026, também registrada em `docs/propostas-pendentes.md` §12.
Na primeira comparação, nenhum código foi alterado. Depois, os itens 5 e 8
foram decididos e feitos.

| # | Ponto | Planilha v22 | App hoje | Muda o valor? |
|---|---|---|---|---|
| 1 | Aceito no galpão | `Aceito = Entrega − Devolução` | Mesma regra: `producerNetQty` (`src/lib/calc.ts`) no modelo atual e RN-02 da spec 008 no núcleo novo | Não, bate |
| 2 | Valor a pagar | `Aceito × (preço − 3,67)` | Mesma fórmula (`producerPayment`) | Não, bate |
| 3 | Desconto de logística | 3,67 **fixo na fórmula** | Configuração com **cópia congelada em cada lançamento** (`logisticsDeductionSnapshot`) | Só se o desconto mudar: a planilha recalcula tudo, o app mantém o valor da época (regra da spec 008, RN-02) |
| 4 | Arredondamento | Linha sem arredondar; total = soma crua (a tela mostra 2 casas) | Cada linha arredondada a centavos; total = soma das linhas arredondadas (RN-15) | **Pode diferir em centavos** no total de um produtor, quando kg × preço tem mais de 2 casas (ex.: 12,5 kg × 11,90 = 148,75, que não arredonda; 3,3 kg × 12,27 = 40,491, que vira 40,49). Decisão já tomada (26/09/2026): vale a do app. |
| 5 | Ficha/romaneio do produtor na tela (`/produtores/[código]`) | Colunas Pedido, Entrega, Devolução, **Aceito**, **Preço líquido**, Valor; linha de Data **e Horário** | **Feito (27/09/2026):** as mesmas colunas, mais data e horário do recebimento em branco (spec 004 RD-15). Antes: só Pedido, Entrega, Devolução e Valor | Não. Só apresentação |
| 6 | Onde se digita a entrega | Entrega no bloco ENTREGA PRODUTORES; na ficha, só a Devolução | Entrega, data, devolução e motivo na mesma linha, em "Divisão / Pedido / Entrega" | Não. É o mesmo dado em outro lugar |
| 7 | Motivo da devolução no galpão | Colunas de código e motivo existem, mas ficam **ocultas** na ficha impressa | Motivo pedido na tela e obrigatório no núcleo novo (RN-21, com "Motivo não identificado") | Não |
| 8 | Complemento que chega **na mesma viagem** (primeira carga) | Soma tudo na ficha da escola (ex.: 170 + 30 = 200 em "Recebido Bruto"). Em COMPLEMENTOS, só o bloco B (paga o 2º produtor), **não** o bloco C, senão a cobrança duplica | **Decidido e feito (27/09/2026), como na planilha** (spec 008 RN-22): um romaneio só por escola e visita. A entrega inicial registra o total (200); o complemento da mesma viagem guarda só a origem e a quantidade (pagamento e auditoria), sem documento próprio e sem somar de novo. Antes, o núcleo novo gerava um romaneio próprio para todo complemento | Não. A cobrança é 200 |
| 9 | Complemento em **outra viagem** | Blocos B e C, com comprovante próprio | Evento de complemento com romaneio próprio | Não, bate |
| 10 | Falta sem complemento | "Encerrada sem atendimento" na ficha da escola, sem passar para a semana seguinte | `ENCERRAR_FALTA_SEM_ATENDIMENTO` com motivo e responsável (RN-09) | Não, bate |

**Resumo:** a v22 não muda nenhuma regra que o app calcula. A única diferença
possível de valor é de **centavos**, pelo arredondamento por linha, já
decidido a favor do app. Os itens 5 e 8 foram alinhados à planilha. Continuam
diferentes só a forma de registro (6) e o motivo oculto na impressão (7).
