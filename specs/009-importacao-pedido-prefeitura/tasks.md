# Tarefas — Especificação 009

Legenda: `[ ]` pendente · `[~]` em andamento · `[x]` concluído · `[B]` bloqueado.

- [x] T01 Reproduzir as falhas do motor antigo (zero descartado, `1.000` → 1, coluna duplicada, conflito 2044, só 1ª aba / exige "CÓDIGO") — confirmadas lendo o código e rodando o motor.
- [x] T02 Grade neutra + leitor `.xlsx` preservando tipos (CA-009.7) — `xlsx.test.ts`.
- [x] T03 Reconhecimento de layout GZ e simples, colunas de Pedido, escolas, linhas ignoradas (CA-009.1–009.4) — `import.test.ts`.
- [x] T04 Plano com decisões, pendências, reconciliação e assinatura (CA-009.5–009.9, 009.11, 009.12) — `import.test.ts`.
- [x] T05 Server Actions: prévia e confirmação com revalidação, transação única, atualização condicionada, auditoria com origem (CA-009.10, 009.11).
- [x] T06 Tela de conferência (abas, produtos, escolas, células, reconciliação, mudanças, ciência de importação parcial).
- [x] T07 PDF com texto (CA-009.13) — `pdf.test.tsx`.
- [x] T08 Grade atualiza após importação sem perder edição em andamento (CA-009.14) — `SchoolOrderCell.tsx`.
- [x] T09 Ovos fora de novos lançamentos (tela e servidor) sem esconder histórico.
- [B] T10 Validar com pedido oficial da prefeitura de Petrópolis (Excel e PDF) — **nenhum exemplo oficial disponível**.
- [B] T11 Associações persistidas entre importações — exige tabela nova (Lucas).
- [B] T12 OCR para PDF digitalizado — infraestrutura não autorizada.

## Evidências (26/09/2026)

- Unitários: `npx vitest run --exclude "**/*.integration.test.ts"` → 110 passando, 1 pulado (teste opcional do GZ real, que passa com `GZ_XLSX_PATH`).
- GZ real (anexo, só leitura): 4 abas selecionadas; 196 linhas de escola; 181 reconhecidas, 16 pendentes (13 códigos desconhecidos, 2 conflitos de nome, 1 código ilegível); 7.459 células de Pedido, 4.251 fora da oferta, 1.922 pendentes (fórmulas sem resultado, precisão, colunas genéricas), 1.286 importáveis.
- Interface (Playwright, build de produção, banco **descartável criado para o teste** `colheita_r2_descartavel_202609261644` com seed fictício): (1) GZ com decisões → 1.871 pedidos gravados em ~5,5 s, 1.871 auditorias com origem; 2044/3016 excluídos; 1096 só por associação explícita; nenhum Ovos; grade mostra os valores sem recarregar. (2) Reimportação → "Nenhum pedido a gravar". (3) Pedido alterado por outra pessoa depois da prévia → gravação recusada, valor da outra pessoa preservado. (4) Zero explícito → 55 → 0. Largura de celular (390 px) sem rolagem lateral.
- Achado durante o teste e corrigido: a checagem de precisão no servidor usava `x*100` em ponto flutuante e recusava valores como 0,29 (a transação foi desfeita inteira — nada gravado pela metade).
