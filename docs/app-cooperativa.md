# App da Cooperativa (modo local)

Uma planilha mais limpa: mesmas contas da MODELO v101 (11/11/2026), em telas.

## Como começar (uma vez só)

1. Instale o **Node.js** (versão LTS) em nodejs.org. Só "avançar, avançar".
2. Baixe o projeto (botão **Code → Download ZIP** no GitHub, ou `git clone`) e
   descompacte numa pasta, ex.: `C:\Cooperativa\app`.
3. Abra o **Prompt de Comando** dentro dessa pasta (na barra de endereço do
   Explorador, digite `cmd` e Enter) e rode:

   ```
   npm install
   ```

4. Copie a pasta `dados-cooperativa` (com cadastro e semanas) para dentro da
   pasta do projeto. Sem ela, o app começa vazio: aí é só trazer o MODELO na
   tela Cadastro.

## Abrir no dia a dia

```
npm run coop
```

Deixe a janela preta aberta e entre em **http://localhost:3000/coop** no
navegador. Para fechar, feche a janela (ou Ctrl+C).

Os dados ficam na pasta `dados-cooperativa/` (fora do Git): `cadastro.json`,
`semanas/aaaa-mm-dd.json`, `previsoes/` e `historico/` (versão anterior de
cada semana, a cada gravação). Para guardar em outro lugar: `COOP_DADOS=...`.
Sem login: só abre no próprio computador.

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
- Desconto por produtor (BALANÇO, coluna "DESCONTO", ex.: folha estragada):
  digita no Fechamento; sai do pagamento e do saldo, igual à planilha.
- Ajustes feitos no app (nome, equipe, escolas que não recebem) ficam guardados
  quando o MODELO é trazido de novo.
