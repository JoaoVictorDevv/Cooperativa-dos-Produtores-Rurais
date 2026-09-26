# Tarefas — Especificação 004

Legenda: `[ ]` pendente · `[~]` em andamento · `[x]` concluído · `[B]` bloqueado.

- [x] T01 (Rodada 1) 7 documentos + ZIP por semana.
- [x] T02 Identificação do ciclo e cabeçalho da tabela repetidos; "Página X de Y" (CA-004.2).
- [x] T03 Romaneio pelo MODELO v20: conferência em branco, data/horário real, nome, assinatura, observações (CA-004.3).
- [x] T04 Quatro vias como opção de impressão; romaneio individual por escola (CA-004.3).
- [x] T05 Aviso de modelo antigo (Entregas às Escolas) e nota de metodologia + termos "A cobrar/A pagar/Resultado calculado" (Balanço) (CA-004.6).
- [x] T06 Nomes de arquivo com ciclo e data; datas em UTC e emissão no fuso de Petrópolis.
- [x] T07 Volume de 191 escolas e desempenho (CA-004.4).
- [x] T08 Ciclo fechado e Ovos desativado no histórico (CA-004.5).
- [B] T09 Romaneio de complemento e aceite real por escola — depende da spec 008 (Lucas).
- [B] T10 Arquivamento imutável do PDF emitido — depende de storage (Lucas/infra).

## Evidências (26/09/2026, build de produção, banco descartável `colheita_r2_descartavel_202609261644`, dados fictícios)

Ciclo aberto com 191 escolas e 1.882 pedidos:

| Documento | Tempo | Páginas | Observações |
|---|---|---|---|
| Pedido das Escolas | 6,0 s | 45 | pág. 2 repete ciclo e cabeçalho; numerado |
| Romaneios das Escolas | 9,8 s | 191 | uma por escola |
| Entregas às Escolas | 0,6 s | 5 | aviso de modelo antigo |
| Pedidos aos Produtores, Galpão, Diferenças, Balanço | < 0,3 s | 1 | |
| ZIP | 10,7 s | 7 arquivos | `semana-1-2026-06-22-*.pdf` |

- Romaneio da escola 1001 em 4 vias: 4 páginas (Via 1 a 4), linha "Data da entrega: ____/____/______ | Horário da entrega: ____:____", Ovos em dz, devolução lançada listada à parte. Inspeção visual feita (pdf.js renderizado no Chromium).
- `?escola=<script>` → 400.
- Ciclo fechado (fechado no banco descartável) depois de desativar Ovos: documentos com "FECHADO", sem aviso de aberto, Ovos presente; tela do ciclo fechado com a coluna Ovos só leitura; ciclo novo sem Ovos.
- Antes da otimização: Pedido das Escolas 24 s e ZIP > 30 s (paginação automática do react-pdf).
- Achado corrigido: o sinal "−" saía em branco nos PDFs (fonte sem o glifo).
