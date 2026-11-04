# Especificação 010 — Gerar pedidos aos produtores a partir da divisão

**Status:** implementada e testada (regra em memória, tela e gravação num
banco descartável). Ver `tasks.md`. Origem: `docs/propostas-pendentes.md` §6
e prompt v2 §5 ("Divisão → pedido sem redigitar").

**O que já existia:** a tela **Produtores** tinha duas colunas separadas por
produtor e produto: **Divisão** (`ProducerAllocation`, planejamento) e
**Pedido** (`ProducerOrder`, o que é emitido ao produtor). Para transformar a
divisão em pedido era preciso redigitar cada valor. Nenhuma regra ligava as
duas.

## Objetivo

Transformar a divisão do ciclo aberto em pedidos aos produtores numa única
ação, com prévia e confirmação, sem apagar nada, sem sobrescrever em silêncio
um pedido digitado diferente e sem tocar em entregas ou devoluções.

## Fluxo de quem opera

1. Em **Produtores** (ciclo aberto), clicar em "+ Gerar pedidos aos produtores
   a partir da divisão" e depois em **Ver prévia**. Nada é gravado.
2. Conferir a tabela **Demanda das escolas × divisão × pedidos** (por produto,
   na unidade do produto): demanda das escolas, total da divisão, pedidos
   hoje, pedidos depois de confirmar e quanto ainda falta pedir.
3. Conferir **Pedidos por produtor**, com a situação de cada linha e as
   contagens. Nas linhas em que o pedido digitado é diferente da divisão,
   marcar "Substituir pelo valor da divisão" só onde for o caso.
4. Clicar em **Gerar N e atualizar M pedido(s)**. O servidor recalcula tudo;
   se algo mudou desde a prévia, recusa e pede nova prévia.
5. A tela de Produtores passa a mostrar os pedidos novos sem recarregar, com
   a indicação "pedido emitido" ao lado da divisão.

## Regras

| Situação da linha (produtor × produto) | O que acontece |
|---|---|
| Divisão > 0, sem pedido (ou pedido registrado com zero) | **Será criado** (ou atualizado de 0) com o valor da divisão |
| Pedido = divisão | **Já igual** — nada muda |
| Pedido > 0 diferente da divisão | **Mantido**, salvo decisão explícita "substituir" naquela linha |
| Pedido sem divisão | **Mantido** e listado; nunca apagado |
| Produto fora da oferta ativa (Ovos) | **Não gera** pedido |

- RN-010.1 A divisão nunca é alterada por esta ação.
- RN-010.2 Entregas, devoluções e pagamentos não são alterados.
- RN-010.3 Pedido criado congela o preço vigente na data de referência do
  ciclo (mesma regra do lançamento manual). Pedido atualizado mantém o preço
  que já tinha.
- RN-010.4 Quantidades comparadas com 2 casas decimais.
- RN-010.5 Só ciclo editável (aberto) e só perfis que podem operar.
- RN-010.6 Tudo numa transação: ou grava todas as linhas da prévia, ou nenhuma.
- RN-010.7 Cada pedido criado ou atualizado gera um registro de auditoria com
  o valor anterior, o novo e o motivo "Gerado a partir da divisão (prévia
  confirmada)".
- RN-010.8 A demanda das escolas na prévia é só comparação de planejamento;
  não é entrega nem recebimento e não mistura unidades (kg × dz).

## Critérios de aceite

- CA-010.1 Divisão sem pedido gera pedido com o mesmo valor.
- CA-010.2 Pedido diferente da divisão não muda sem a marcação da linha; com
  a marcação, passa a ser o valor da divisão.
- CA-010.3 Pedido sem divisão continua existindo depois de confirmar.
- CA-010.4 Nenhum pedido de produto fora da oferta é criado.
- CA-010.5 Confirmar de novo não duplica nem altera nada ("Nada a gerar").
- CA-010.6 Se a divisão ou um pedido mudar entre a prévia e a confirmação, a
  gravação é recusada e nada é gravado.
- CA-010.7 Pedido criado tem preço congelado; auditoria registrada com motivo.
- CA-010.8 A linha do produtor mostra o pedido gravado sem recarregar a
  página, sem perder um valor que esteja sendo digitado.

## Fora do escopo

- Gerar a divisão automaticamente a partir da demanda das escolas (decisão
  operacional de quem fornece quanto — não proposta aqui).
- PDF/aviso ao produtor: continua o PDF "Pedidos aos Produtores" existente.
- Persistência na API Java: esta ação usa as tabelas atuais (Prisma), sem
  mudança de schema.
