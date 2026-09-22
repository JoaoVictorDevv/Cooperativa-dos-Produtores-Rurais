# Atualização da planilha: v27 → v35 (o que mudou desde o prompt original)

O Claude Code recebeu contexto baseado na v27. Comparei célula por célula, aba por
aba, contra a v35 atual — isto é tudo que mudou de verdade, sem nada de memória.

## 1. Removido: aba "LIMITE ANUAL PNAE"

Ela não existe mais na planilha. **Confirma que isso não muda nada do que já foi
pedido no app** — o controle do teto de R$40.000/produtor/ano deve continuar sendo
calculado automaticamente a partir do histórico semanal, como já estava especificado.
Só não há mais essa aba de referência na planilha porque decidimos não manter um
controle manual redundante ali.

## 2. Nova aba operacional: "MAPA DE MONTAGEM" (a mudança grande)

Antes era um placeholder vazio. Agora é uma ferramenta real de logística para o
galpão, com **18 rotas fixas**, definidas por um plano de rota oficial da cooperativa
(documento externo, não recalculado pelo sistema):

- **Segunda-feira**: rotas S1 a S10 — 100 escolas
- **Terça-feira**: rotas T1 a T8 — 91 escolas
- **191 escolas no total, mas 180 paradas físicas** — 11 pares de escolas dividem o
  mesmo endereço (ex: duas escolas na mesma rua), mas continuam sendo **entidades
  separadas**: pedido, devolução e romaneio individuais, cada uma. Elas só
  compartilham a parada (identificadas como "4A" e "4B", por exemplo).

Cada rota tem:
- Veículo-base sugerido (caminhão médio, kombi, ou kombi + último trecho por moto)
- Corredor/região
- Sequência de escolas **fixa**, na ordem de entrega real (não é otimizada pelo
  sistema, vem de um planejamento logístico já pronto)
- Uma linha de controle no fim: **peso previsto** (somado automaticamente, só dos
  produtos em kg — não soma os ovos, que são em dúzia), e 3 campos de preenchimento
  manual: peso embarcado, veículo confirmado, motorista.

**Isso deveria virar uma tela própria no app** — provavelmente a mais usada no
dia a dia de quem monta a carga no galpão. Sugestão de dado: uma tabela de
referência com as 18 rotas (nome, dia, veículo-base, lista de escolas na ordem,
e quais paradas são compartilhadas) — posso exportar isso em CSV/JSON se ajudar.

## 3. Correção de unidade: Ovos é vendido por DÚZIA, não por kg

Em todo lugar que antes dizia genericamente "(kg)", o item Ovos agora aparece como
**"Ovos (dz)"**. Isso é só rótulo — o valor pago continua sendo quantidade × preço,
sem mudar a conta. Mas é importante o app **não somar dúzias de ovos dentro de um
total em quilos** (esse foi o motivo de existir o "peso previsto" separado por kg no
Mapa de Montagem, excluindo ovos da soma).

## 4. Trava nova: devolução não pode passar da entrega/pedido

Antes não existia nenhuma validação. Agora, se alguém tentar digitar uma devolução
maior do que a quantidade pedida (escola) ou entregue (produtor), o sistema **recusa
o valor** — é fisicamente impossível devolver mais do que se recebeu. Isso é uma
regra de negócio que o app deveria implementar como validação de formulário, não só
como aviso.

## 5. Aba "DIFERENÇA" — visual novo, útil de copiar

Ganhou uma coluna de **STATUS automático**: `FALTA` (vermelho) quando o pedido não
foi totalmente atendido, `SOBRA` (amarelo) quando veio mais do que o pedido, `OK`
(verde) quando bateu exato. É comparação por produto (pedido total das escolas vs.
entrega líquida total dos produtores), não por escola individual. Esse padrão visual
(vermelho/amarelo/verde com rótulo textual) é um bom modelo pro dashboard do app.

## 6. Pequenos ajustes de navegação (irrelevantes pro app)

- Índice reorganizado (removida referência ao Limite Anual, adicionados links para
  Diferença e Mapa de Montagem, tutorial atualizado).
- Filtro automático nas abas de produtor simplificado (só na coluna Entrega).
- Cor de destaque das paradas compartilhadas no Mapa de Montagem (visual apenas).

Essas três não têm nenhum efeito na lógica de negócio nem precisam virar
funcionalidade no app — são só organização da planilha em si.

---

## Resumo rápido pra colar

> Atualizamos a planilha de referência (agora na v35). O essencial que muda pro app:
> 1. Removemos a aba de Limite Anual PNAE da planilha (não muda a spec do app —
>    continua precisando ser automático via histórico).
> 2. Adicionamos o Mapa de Montagem de verdade: 18 rotas fixas (S1-S10 segunda/100
>    escolas, T1-T8 terça/91 escolas), 180 paradas físicas (11 compartilhadas por
>    duas escolas cada), com peso previsto automático (só kg, sem ovos) e campos
>    manuais de peso embarcado/veículo/motorista por rota — isso pede uma tela
>    própria no app.
> 3. Ovos agora é tratado explicitamente como "dúzia", não "kg" — cuidado pra não
>    somar junto com os demais produtos em nenhum total de peso.
> 4. Adicionamos validação: devolução nunca pode ser maior que pedido/entrega — trata
>    isso como regra de validação de formulário no app.
> 5. A aba Diferença ganhou um status visual (FALTA/SOBRA/OK) por produto — bom
>    padrão pra copiar num dashboard.
