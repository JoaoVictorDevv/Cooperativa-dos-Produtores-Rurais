# Plano técnico — Especificação 009

## Componentes

| Arquivo | Papel |
|---|---|
| `src/lib/import/types.ts` | Grade neutra (`RawWorkbook`) e resultado reconhecido (`ParsedWorkbook`) |
| `src/lib/import/xlsx.ts` | `.xlsx` → grade neutra (exceljs). Preserva vazio, zero, texto, erro, fórmula sem resultado, data, mesclada, aba oculta |
| `src/lib/import/pdf.ts` | PDF com texto → grade neutra (unpdf/pdf.js, local). Uma "aba" por página |
| `src/lib/import/text.ts` | Normalização, código de escola, números em texto, comparação de nomes, unidade no cabeçalho |
| `src/lib/import/parseSheet.ts` | Reconhecimento de layout (PEDIDO_ENTREGA / SIMPLES), colunas, escolas, linhas ignoradas |
| `src/lib/import/plan.ts` | Decisões → linhas a gravar, pendências, reconciliação, assinatura |
| `src/lib/productPolicy.ts` | Oferta ativa (Ovos retirado) |
| `src/app/actions/schoolOrdersImport.ts` | Prévia e confirmação (Server Actions) |
| `src/app/(app)/escolas/ImportSchoolOrders.tsx` | Tela de conferência |
| `next.config.ts` | `serverActions.bodySizeLimit = 8mb` (a GZ tem 2,1 MB; o padrão é 1 MB) |

O reconhecimento e o plano são puros e rodam no navegador (prévia interativa)
e no servidor (confirmação). O servidor nunca confia no resultado enviado
pelo navegador: recalcula e compara a assinatura.

## Backend e dados

- Grava em `SchoolOrder` (Prisma, backend atual das telas) e `AuditLog`. Sem
  mudança de schema.
- Quando as telas passarem a consumir a API Java (contrato em
  `docs/propostas-pendentes.md` §7), a API precisará de um endpoint de
  gravação em lote de pedidos escolares com as mesmas garantias (transação
  única, atualização condicionada ao valor anterior, auditoria com origem,
  preço congelado na criação). O motor de leitura (`src/lib/import/*`) pode
  continuar no Next ou virar serviço — decisão com o Lucas.
- **Associações persistidas** (lembrar decisões entre importações) exigiriam
  uma tabela nova (`import_mappings`: organização, tipo coluna/escola, rótulo
  normalizado da origem, alvo, usuário, data, ativo). Não criada: é schema
  (Lucas). Não se usa localStorage/observações como substituto.

## Riscos e limites

- Leitura de 2 MB leva ~3 s no servidor; prévia completa na tela ~5 s.
- Resposta da prévia do GZ ≈ 1,4 MB (inclui a aba oculta antiga). Aceitável
  em rede local; se virar problema, reduzir enviando só abas selecionadas.
- PDF: reconstrução de tabela por posição; layouts muito diferentes (colunas
  sem cabeçalho, texto girado) podem exigir ajuste. Nenhum PDF oficial foi
  testado.

## Estratégia de testes

- Unitários (`npx vitest run src/lib/import`): estrutura GZ sintética
  (`src/lib/import/fixtures/gzLike.ts`), layout simples, números em texto,
  191 escolas, `.xlsx` gerado com exceljs (tipos de célula), PDF gerado com
  @react-pdf/renderer.
- Opcional com o arquivo real: `GZ_XLSX_PATH=<caminho do anexo> npx vitest run src/lib/import`.
- Interface + banco descartável (Playwright, ver `tasks.md`).
