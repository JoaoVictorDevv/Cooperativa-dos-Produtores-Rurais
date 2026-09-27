# Validação de ciclo fechado — modelo atual × lógica corrigida

**Pedido (27/09/2026):** validar, contra um ciclo real fechado, a parte do
galpão (recebimento, rejeição, valor a pagar aos produtores), custos e
diferença, comparando com o modelo atual; documentar que a cobrança escolar
não é validável.

## O que foi feito

- `src/lib/cycleCore/currentTables.ts`: lê um ciclo nas tabelas atuais (só
  leitura) no formato do núcleo — é também o adaptador que a troca de fonte
  vai usar.
- `src/lib/cycleCore/galpaoParity.ts`: compara, linha a linha (produtor ×
  produto) e no total, bruto, rejeição no galpão, aceito e a pagar; custos; e,
  por produto, pedido das escolas, líquido do galpão e diferença. Aponta
  anomalias (ex.: devolução no galpão sem entrega).
- `scripts/validate-closed-cycle.ts`: executa a comparação num ciclo fechado
  com **conexão somente leitura** (conferida no servidor antes de ler) e
  imprime um relatório; recusa ciclo aberto; nunca imprime a URL.

## Resultado

| Onde | Resultado |
|---|---|
| Ciclo fechado **fictício** em banco descartável (4 lançamentos no galpão com decimais, rejeições, entrega zero, 2 descontos diferentes, 2 custos, devolução escolar) | **Tudo confere**: a pagar 2.451,39 nos dois lados, linha a linha; custos 470,40; diferença por produto igual. Script de ponta a ponta: conexão somente leitura, relatório "OK", nada gravado. |
| Comparação com divergência proposital (teste unitário) | Detecta pagamento, custo, pedido e diferença divergentes e lançamento que existe só de um lado. |
| **Ciclo real fechado** | **Não executado nesta sessão.** Não há ciclo real acessível: a leitura do banco configurado no ambiente foi bloqueada pela política de permissões da sessão e as planilhas de referência (v20, v27, v35) são modelos sem dados. |

**Para validar um ciclo real** (quem tem acesso; nada é gravado):

```bash
VALIDATION_DATABASE_URL="postgresql://…" npx tsx scripts/validate-closed-cycle.ts --semana <número> --saida validacao.md
```

Saída 0 = confere; 1 = divergência ou anomalia (listadas); 2 = recusa/erro.

## Não validável (bloqueio de persistência — Lucas)

A **cobrança da prefeitura pelo aceito na escola** e tudo que depende dela
(falta, excedente, rejeição e perda por escola, complementos, decisões de
falta) **não pode ser validada com nenhum ciclo real**: nenhum ciclo tem entrega
por escola/produto registrada, porque as tabelas atuais (e as do banco novo)
só guardam a data de atendimento por escola. Não é um passo pendente do app:
depende de existir onde registrar essa entrega (`docs/propostas-pendentes.md`
§9 e §10). Para esses ciclos, o valor oficial continua o do modelo atual
(pedido − devolução) e não é recalculado.

## O que isso muda na troca de fonte

Na parte do galpão, custos e diferença, a lógica corrigida usa as mesmas
tabelas e dá os mesmos números — a troca não causa descontinuidade nessas
partes. A troca das semanas reais continua **desligada**
(`methodologyOfRealCycle()` = modelo atual) até existirem a persistência das
entregas por escola e a metodologia gravada por ciclo.
