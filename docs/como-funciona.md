# Como o app funciona por dentro

Uma planilha mais limpa: mesmas contas da MODELO v102 (14/11/2026), em telas.
Instalar e usar: [COMO-USAR.md](../COMO-USAR.md).

Os dados ficam na pasta `dados-cooperativa/` (fora do Git): `cadastro.json`,
`semanas/aaaa-mm-dd.json`, `previsoes/`, `historico/` (cópia anterior de cada
semana a cada gravação) e `meta.json`. Outro lugar: variável `COOP_DADOS`.

## Abrir no dia a dia

Dois cliques no atalho **App Cooperativa** (ou em `abrir-app.bat`). Detalhes
em [COMO-USAR.md](../COMO-USAR.md).

Linha de comando: `npm run coop` (modo final) ou `npm run coop:dev`
(desenvolvimento). Conferir o motor com uma planilha recalculada:
`npm run conferir -- <semana.xlsx> <recalculada.xlsx>`.

## A semana, na ordem

| Passo | Tela |
| --- | --- |
| Perguntar a previsão e montar a tabela da nutricionista | Previsão |
| Pedido da Prefeitura: cortes por produto × modalidade | Nova semana |
| Divisão entre produtores e mensagens do WhatsApp (wa.me) | 1. Pedido e mensagens |
| O que cada produtor trouxe (balança, caixas 4 kg / 2 kg), quem conferiu, hora, qualidade | 2 e 3. Galpão (funciona no celular) |
| Mapa de montagem (colunas na ordem da planilha), EXCEDENTE do dia, reentregas e romaneios; botão **Tudo do dia** imprime mapa + excedente + romaneios de uma vez | 4. Mapa e romaneios |
| Faltas e recusas das escolas (busca por código/nome, tela ou texto: `1005 não veio cheiro verde`); escola fechada → **reentrega** outro dia/rota com o mesmo romaneio | 5. Retornos |
| Conferência da Prefeitura, custos, extratos, resumo do Paulo | 6. Fechamento |
| Todas as semanas lado a lado (saldo, custos, perdas), para o Paulo; imprime em 1 página | Resumo |
| Mês a mês, perdas, vendido por produtor (R$ 40 mil só informação) | Relatórios |
| Nome da cooperativa, equipe do galpão, escolas que não recebem (ex.: não faz almoço) | Cadastro |

Impressão: os botões 🖨 abrem a folha pronta; no navegador, Imprimir ou
"Salvar como PDF".

## Regras (iguais à planilha)

- Contas em `src/lib/coop/motor.ts`, conferidas célula a célula com as
  semanas 20/10 e 26/10: `npx tsx scripts/coop/conferir-motor.ts <semana.xlsx> <recalculada.xlsx>`.
- Galpão: em branco = veio o pedido do dia (o app grava o planejado; a
  planilha pagaria 0).
- Trouxe a mais: a sobra não é paga. Extra (complemento) segue a regra do `_EXTRA`.
- v100 (04/11): folha não dorme no galpão — rotas de terça usam só o que chegou
  no 2º dia. EXCEDENTE: folhas e repolho por rota (1 a 4), legumes por escola
  (v101: legume não vai a mais; brócolis vem todo no 1º dia).
- Administrativo: o custo da semana é o combinado (pago + o que ficou
  faltando). O que falta é dívida da cooperativa e aparece somado em
  Relatórios. A planilha (BALANÇO D19) conta só o pago; por isso o saldo do
  app fica menor que o D21 pelo valor que falta.
- Cobrança sem conferência (RESUMO C29): o que as escolas aceitaram, mas
  nunca mais do que chegou no galpão menos o que as escolas recusaram.
  Semana sem entrega lançada = nada a cobrar ainda.
- "1º dia" digitado por cima (aba PROD coluna T): em Pedido → Mexer.
- Desconto por produtor (BALANÇO, coluna "DESCONTO", ex.: folha estragada):
  digita no Fechamento; sai do pagamento e do saldo, igual à planilha.
- Ajustes feitos no app (nome, equipe, escolas que não recebem) ficam guardados
  quando o MODELO é trazido de novo.
