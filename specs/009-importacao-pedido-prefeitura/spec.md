# Especificação 009 — Importação do pedido da prefeitura (Excel e PDF com texto)

**Status:** implementada e testada (Excel e PDF com texto) — ver `tasks.md`.
Validada com a estrutura do arquivo GZ (anexo do prompt v2) e com arquivos
fictícios. **Não** validada com um pedido oficial da prefeitura de
Petrópolis (nenhum foi fornecido) nem com PDF oficial.

**O que já existia antes desta rodada:** a Rodada 1 entregou uma importação
básica de Excel (`src/lib/importSchoolOrders.ts`, removida nesta rodada) que
lia só a primeira aba, exigia uma coluna "CÓDIGO", descartava zero explícito,
lia `1.000` como 1 e não detectava coluna duplicada nem conflito
código × nome. Esta spec substitui aquele motor; o fluxo de prévia →
confirmação → gravação atômica foi preservado e reforçado.

## Objetivo

Preencher o **pedido das escolas** de um ciclo a partir do arquivo da
prefeitura, com conferência humana de tudo que não for inequívoco, sem
adivinhar e sem gravar nada antes da confirmação.

## Fluxo de quem opera

1. Em **Pedido das Escolas** (ciclo aberto), clicar em "+ Importar pedido da
   prefeitura (Excel ou PDF com texto)". O ciclo de destino é mostrado.
2. Escolher o arquivo `.xlsx` ou `.pdf`. O servidor lê e reconhece; nada é
   gravado.
3. Conferir e decidir, na mesma tela:
   1. **Abas/páginas** a importar (padrão: abas visíveis com pedidos por
      escola; ocultas, de totais e vazias ficam fora).
   2. **Produtos**: colunas reconhecidas, nomes genéricos a confirmar
      (Alface, Couve, Maçã, Tangerina), duplicadas, fora da oferta.
      Confirmar que as colunas sem unidade estão na unidade do cadastro.
   3. **Escolas**: códigos desconhecidos (com sugestões), código com nome de
      outra escola, código ilegível, escola repetida em várias linhas/abas.
   4. **Células**: ambíguas (`1.000`), com mais de 2 casas, inválidas.
   5. **Reconciliação** e **lista do que muda** (novo, alteração, redução,
      zerar), com a origem de cada valor (aba!célula).
4. Marcar ciência da importação parcial (se houver itens fora) e gravar.

## Regras

- **RI-01 Só pedido**: importar preenche `SchoolOrder`. Nunca cria entrega,
  recebimento nem pedido ao produtor. Colunas "Entrega" do arquivo são
  ignoradas (contadas na prévia).
- **RI-02 Oferta ativa**: só produtos ativos e não retirados. Ovos está
  retirado do fluxo ativo (`src/lib/productPolicy.ts`); a coluna aparece como
  fora da oferta, listada, nunca importada.
- **RI-03 Código é a chave, nome confere**: código igual com nome de outra
  instituição é conflito (ex.: 2044 Padre Quinha × Santo Antônio; 3016
  Soroptimista × Pedras Brancas). Abreviação (E.M. × Escola Municipal) não é
  conflito. Código com sufixo (1096.1) não vira 1096 sem decisão.
- **RI-04 Nome genérico não associa sozinho**: Alface ≠ Alface lisa sem
  confirmação; Couve sugere Couve manteiga **e** Couve-flor.
- **RI-05 Vazio × zero**: vazio não altera nada (nem apaga); zero explícito
  atualiza (20 → 0 aparece como "Zerar").
- **RI-06 Sem adivinhação numérica**: texto `1.000`/`12.500`/`1,500` é
  ambíguo e exige escolha; célula numérica não é ambígua. Erro de célula,
  fórmula sem resultado, texto, data, negativo = pendência, nunca zero.
- **RI-07 Precisão**: o banco guarda 2 casas. Ruído binário
  (1.7999999999999998) é 1,80. Mais casas reais (7,568) só entram se a regra
  "arredondar para 2 casas, meio para cima" for aceita na prévia; o valor
  original é mostrado.
- **RI-08 Unidades**: coluna com unidade diferente do cadastro (ex.: "(cx)"
  para produto em kg) não é importada — sem conversão. Coluna sem unidade
  exige confirmação explícita.
- **RI-09 Duplicidades**: duas colunas para o mesmo produto → nenhuma entra
  até escolher. Escola em mais de uma linha/aba → somar, usar uma, ou excluir,
  por decisão explícita. Nada sobrescreve em silêncio.
- **RI-10 Revalidação no servidor**: a gravação relê o mesmo arquivo,
  reaplica as decisões com cadastro/pedidos atuais e só grava se o resultado
  for idêntico ao da prévia (assinatura das linhas); checa permissão, ciclo
  aberto, oferta ativa, precisão, devolução já lançada e alteração concorrente
  (atualização condicionada ao valor mostrado).
- **RI-11 Atômico e idempotente**: uma transação; qualquer erro desfaz tudo.
  Reimportar o mesmo arquivo não soma nem regrava ("Nenhum pedido a gravar").
- **RI-12 Rastreabilidade**: cada pedido criado/alterado gera auditoria com
  valor antes/depois, células de origem e motivo
  `Importado de "<arquivo>" (Excel|PDF; abas: …)`.
- **RI-13 Proteção de devolução (modelo atual)**: pedido importado menor que
  a devolução já lançada é pendência obrigatória. No modelo novo (spec 008) a
  rejeição escolar será limitada pela entrega real, não pelo pedido.
- **RI-14 PDF**: só PDF com texto, extraído localmente (sem serviço externo).
  Cada página vira uma "aba"; cabeçalho repetido e subtotais são ignorados.
  PDF digitalizado é recusado com explicação (OCR não disponível).

## Critérios de aceite

- **CA-009.1** GZ: 4 abas de modalidade reconhecidas (cabeçalho em 2 linhas,
  código na A), TOTAL como totalização, aba oculta de 2020 e abas vazias fora
  da seleção padrão.
- **CA-009.2** Só colunas de Pedido; Entrega nunca é importada.
- **CA-009.3** Conflitos 2044 e 3016 detectados e só importados com decisão.
- **CA-009.4** Alface/Couve/Maçã/Tangerina exigem confirmação; Ovo fora da
  oferta.
- **CA-009.5** Zero explícito atualiza 20 → 0; vazio não apaga.
- **CA-009.6** `1.000` textual exige escolha; coluna repetida exige decisão.
- **CA-009.7** Fórmula sem resultado e erro de célula são pendências.
- **CA-009.8** Precisão > 2 casas só com regra aceita.
- **CA-009.9** Reconciliação: origem = fora da oferta + pendentes + excluídas
  por decisão + importáveis; mostra linhas de escola reconhecidas/pendentes/
  excluídas e o total a gravar.
- **CA-009.10** Alteração concorrente depois da prévia aborta a gravação.
- **CA-009.11** Reimportação idêntica não grava nada.
- **CA-009.12** 191 escolas × produtos ativos reconhecidas sem pendência;
  gravação de ~1.900 pedidos em uma transação em poucos segundos.
- **CA-009.13** PDF com texto (tabela com cabeçalho repetido por página e
  subtotal) chega à mesma prévia; PDF sem texto é recusado.
- **CA-009.14** A grade de pedidos mostra os valores importados sem
  recarregar a página e sem apagar uma edição em andamento.

## Fora de escopo / limites declarados

- OCR de PDF digitalizado (depende de infraestrutura não autorizada).
- Associações persistidas (lembrar que "Alface" = Alface lisa entre
  importações) — exigiria tabela nova; por ora a conferência é por
  importação. Ver `plan.md`.
- Compatibilidade com PDF oficial da prefeitura: **não testada** (nenhum
  exemplo disponível). Layouts de PDF testados: tabela simples gerada por
  sistema (CÓDIGO | ESCOLA | produtos), várias páginas, cabeçalho repetido,
  subtotal.
- Planilhas `.xls` antigas: não suportadas (pedir `.xlsx`).
