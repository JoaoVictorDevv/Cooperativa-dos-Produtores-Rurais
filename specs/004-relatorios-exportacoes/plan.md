# Plano técnico — Especificação 004

## Componentes

- `src/lib/pdf/SimpleReport.tsx` — relatório tabular; `PageFrame` (identificação
  fixa + "Página X de Y"), `TableHeader` fixo e `paginate()` (paginação manual).
- `src/lib/pdf/SchoolRomaneiosDocument.tsx` — romaneio por escola, 1 ou 4 vias.
- `src/lib/pdf/BalanceReportDocument.tsx` — balanço com nota de metodologia.
- `src/lib/pdf/reports.tsx` — busca de dados e montagem; `ReportOptions`
  (`schoolCode`, `copies`); nomes de arquivo.
- `src/lib/pdf/styles.ts` — estilos, `LEGACY_BILLING_NOTE`, datas em UTC/Petrópolis.
- Rotas `src/app/api/semanas/[weekId]/pdf/[report]` (`?escola=`, `?vias=4`) e `/zip`.
- Telas: `/semanas/[weekId]` (documentos, romaneios em 4 vias), ficha da escola
  (romaneio individual).

## Decisões

- **Paginação manual**: o react-pdf quebra páginas automaticamente de forma
  muito lenta em listas longas (1.900 linhas: 22 s). Paginando em blocos de
  linhas por página: 3,4 s. Se uma página transbordar (nome longo), o
  react-pdf quebra o excedente e o cabeçalho fixo se repete.
- **Romaneio sem numeração dinâmica**: cada romaneio é de uma página; o rodapé
  traz o número do documento e a via (numeração dinâmica custava ~2 s em
  191 páginas).
- **Fonte padrão (Helvetica/WinAnsi)**: não tem o sinal "−" (U+2212) —
  usar hífen nos textos dos PDFs.

## Quando a spec 008 for integrada

- Romaneio: imprimir o aceito confirmado depois da entrega e gerar romaneio de
  complemento separado.
- "Entregas às Escolas" passa a mostrar entregue/rejeitado/aceito por produto.
- Balanço/Resumo: cobrança pelo aceito na escola, com a metodologia do ciclo.

## Testes

Ver `tasks.md` (evidências).
