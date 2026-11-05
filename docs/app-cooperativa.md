# App da Cooperativa (modo local)

Uma planilha mais limpa: mesmas contas da MODELO v100, em telas.

## Abrir

```
npm install        # só na primeira vez
npm run coop       # abre em http://localhost:3000/coop
```

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
| O que cada produtor trouxe (balança, caixas 4 kg / 2 kg) | 2 e 3. Galpão |
| Mapa de montagem e romaneios (escolas na ordem da rota) | 4. Mapa e romaneios |
| Faltas e recusas das escolas (tela ou texto: `1005 não veio cheiro verde`) | 5. Retornos |
| Conferência da Prefeitura, custos, extratos, resumo do Paulo | 6. Fechamento |
| Mês a mês, perdas, vendido por produtor (R$ 40 mil só informação) | Relatórios |

Impressão: os botões 🖨 abrem a folha pronta; no navegador, Imprimir ou
"Salvar como PDF".

## Regras (iguais à planilha)

- Contas em `src/lib/coop/motor.ts`, conferidas célula a célula com as
  semanas 20/10 e 26/10: `npx tsx scripts/coop/conferir-motor.ts <semana.xlsx> <recalculada.xlsx>`.
- Galpão: em branco = veio o pedido do dia (o app grava o planejado; a
  planilha pagaria 0).
- Trouxe a mais: a sobra não é paga. Extra (complemento) segue a regra do `_EXTRA`.
