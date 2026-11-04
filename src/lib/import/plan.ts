// Plano de gravação da importação: aplica as decisões de quem confere sobre o
// resultado do reconhecimento e produz as linhas a gravar, as pendências e a
// reconciliação. Puro e determinístico: roda no navegador (prévia) e de novo
// no servidor (confirmação), que só grava se o resultado for o mesmo.

import { round2 } from "../calc";
import type { CatalogProduct, CatalogSchool, CellParse, ParsedSheet, ParsedWorkbook } from "./types";

export interface ImportDecisions {
  selectedSheets: string[];
  // "aba!coluna" → produto confirmado, ou null para excluir. Ausente = padrão
  // (AUTO usa o produto reconhecido; o resto fica fora).
  columnProduct: Record<string, string | null>;
  // Colunas sem unidade no cabeçalho usam a unidade do cadastro.
  unitConfirmed: boolean;
  // Aceita arredondar para 2 casas (meio para cima) células com mais casas.
  acceptRounding: boolean;
  // "aba!linha" → escola confirmada, ou null para excluir.
  rowSchool: Record<string, string | null>;
  // escola que aparece em mais de uma linha: somar, excluir ou usar "aba!linha".
  duplicateSchool: Record<string, "SOMAR" | "EXCLUIR" | string>;
  // "aba!A1" → valor escolhido para célula ambígua, ou null para excluir.
  cellValue: Record<string, number | null>;
  // "escolaId:produtoId" excluídos da gravação.
  excludedLines: Record<string, true>;
  acknowledgeExclusions: boolean;
}

export function defaultDecisions(parsed: ParsedWorkbook): ImportDecisions {
  return {
    selectedSheets: parsed.sheets.filter((s) => s.kind === "PEDIDOS" && !s.hidden).map((s) => s.name),
    columnProduct: {},
    unitConfirmed: false,
    acceptRounding: false,
    rowSchool: {},
    duplicateSchool: {},
    cellValue: {},
    excludedLines: {},
    acknowledgeExclusions: false,
  };
}

export interface PlanContext {
  schools: CatalogSchool[];
  products: CatalogProduct[];
  existingOrders: Record<string, number>;
  existingReturns: Record<string, number>;
}

export type PendingKind =
  | "COLUNA_SUGESTAO"
  | "COLUNA_DUPLICADA"
  | "COLUNA_UNIDADE"
  | "UNIDADE_NAO_CONFIRMADA"
  | "ESCOLA_DESCONHECIDA"
  | "ESCOLA_NOME_DIVERGENTE"
  | "CODIGO_ILEGIVEL"
  | "ESCOLA_DUPLICADA"
  | "CELULA_AMBIGUA"
  | "CELULA_INVALIDA"
  | "CELULA_PRECISAO"
  | "ABAIXO_DA_DEVOLUCAO";

export interface PendingItem {
  kind: PendingKind;
  sheet: string | null;
  // Localização legível: "D6", "linha 14", "coluna Q".
  where: string;
  key: string;
  message: string;
  // Bloqueante: impede confirmar até ser resolvido ou excluído.
  blocking: boolean;
}

export type LineChange = "NOVO" | "ALTERACAO" | "ZERAR" | "SEM_MUDANCA";

export interface PlanLine {
  schoolId: string;
  productId: string;
  newQty: number;
  currentQty: number | null;
  change: LineChange;
  sources: string[];
}

export interface ColumnSummary {
  sheet: string;
  letter: string;
  label: string;
  status: "INCLUIDA" | "FORA_DA_OFERTA" | "NAO_RECONHECIDA" | "SUGESTAO_PENDENTE" | "DUPLICADA" | "UNIDADE_DIFERENTE" | "EXCLUIDA_POR_DECISAO";
  productId: string | null;
  filledCells: number;
}

export interface ImportPlan {
  lines: PlanLine[];
  pending: PendingItem[];
  columns: ColumnSummary[];
  reconciliation: {
    selectedSheets: string[];
    sourceCells: number;
    outOfOfferCells: number;
    offeredCells: number;
    pendingCells: number;
    excludedByDecisionCells: number;
    importedCells: number;
    confirmedLines: number;
    confirmedQty: number;
    changes: Record<LineChange, number>;
    schoolRows: { recognized: number; pending: number; excluded: number };
  };
  canConfirm: boolean;
  confirmBlockers: string[];
}

const colKey = (sheet: string, letter: string) => `${sheet}!${letter}`;
const rowKey = (sheet: string, row: number) => `${sheet}!${row}`;
const cellKey = (sheet: string, letter: string, row: number) => `${sheet}!${letter}${row}`;
export const lineKey = (schoolId: string, productId: string) => `${schoolId}:${productId}`;

interface EffectiveColumn {
  index: number;
  productId: string | null;
  status: ColumnSummary["status"];
}

function effectiveColumns(sheet: ParsedSheet, decisions: ImportDecisions, products: Map<string, CatalogProduct>, pending: PendingItem[]): EffectiveColumn[] {
  const result: EffectiveColumn[] = sheet.columns.map((col, index) => {
    const key = colKey(sheet.name, col.letter);
    const decided = key in decisions.columnProduct ? decisions.columnProduct[key] : undefined;
    let productId: string | null = null;
    let status: ColumnSummary["status"];
    if (decided === null) status = "EXCLUIDA_POR_DECISAO";
    else if (decided !== undefined) {
      const p = products.get(decided);
      productId = p?.offered ? p.id : null;
      status = productId ? "INCLUIDA" : "FORA_DA_OFERTA";
    } else if (col.match.kind === "AUTO") {
      productId = col.match.productId;
      status = "INCLUIDA";
    } else if (col.match.kind === "SUGESTAO") {
      status = "SUGESTAO_PENDENTE";
      const names = col.match.candidateIds.map((id) => products.get(id)?.name).filter(Boolean).join(" ou ");
      pending.push({
        kind: "COLUNA_SUGESTAO",
        sheet: sheet.name,
        where: `coluna ${col.letter}`,
        key,
        message: `"${col.label}" é genérico: confirme se é ${names} ou exclua a coluna. Nome genérico não é associado automaticamente.`,
        blocking: false,
      });
    } else if (col.match.kind === "FORA_DA_OFERTA") status = "FORA_DA_OFERTA";
    else status = "NAO_RECONHECIDA";

    if (productId && col.unit) {
      const product = products.get(productId)!;
      if (product.unit !== col.unit) {
        pending.push({
          kind: "COLUNA_UNIDADE",
          sheet: sheet.name,
          where: `coluna ${col.letter}`,
          key,
          message: `"${col.label}" está em ${col.unit}, mas ${product.name} é controlado em ${product.unit}. Sem regra de conversão confirmada, a coluna não é importada.`,
          blocking: false,
        });
        productId = null;
        status = "UNIDADE_DIFERENTE";
      }
    }
    return { index, productId, status };
  });

  // Duas colunas da mesma aba para o mesmo produto: nenhuma entra até decidir.
  const byProduct = new Map<string, EffectiveColumn[]>();
  for (const c of result) if (c.productId) byProduct.set(c.productId, [...(byProduct.get(c.productId) ?? []), c]);
  for (const [productId, cols] of byProduct) {
    if (cols.length < 2) continue;
    const letters = cols.map((c) => sheet.columns[c.index].letter);
    pending.push({
      kind: "COLUNA_DUPLICADA",
      sheet: sheet.name,
      where: `colunas ${letters.join(", ")}`,
      key: `${sheet.name}|${productId}`,
      message: `As colunas ${letters.join(", ")} (${cols.map((c) => `"${sheet.columns[c.index].label}"`).join(", ")}) apontam para ${products.get(productId)?.name}. Escolha uma e exclua as outras.`,
      blocking: false,
    });
    for (const c of cols) {
      c.productId = null;
      c.status = "DUPLICADA";
    }
  }
  return result;
}

interface Contribution {
  sheet: string;
  row: number;
  address: string;
  value: number;
}

export function buildImportPlan(parsed: ParsedWorkbook, decisions: ImportDecisions, ctx: PlanContext): ImportPlan {
  const products = new Map(ctx.products.map((p) => [p.id, p]));
  const schools = new Map(ctx.schools.map((s) => [s.id, s]));
  const pending: PendingItem[] = [];
  const columns: ColumnSummary[] = [];
  let sourceCells = 0;
  let outOfOfferCells = 0;
  let offeredCells = 0;
  let pendingCells = 0;
  let excludedByDecisionCells = 0;
  let importedCells = 0;
  let needsUnitConfirmation = false;
  const schoolRowCounts = { recognized: 0, pending: 0, excluded: 0 };

  // escolaId → linhas (aba!linha) onde aparece, para detectar duplicidade.
  const rowsBySchool = new Map<string, string[]>();
  // (escola, produto) → contribuições por linha de origem.
  const contributions = new Map<string, Map<string, Contribution[]>>();

  const selected = parsed.sheets.filter((s) => s.kind === "PEDIDOS" && decisions.selectedSheets.includes(s.name));

  for (const sheet of selected) {
    const effCols = effectiveColumns(sheet, decisions, products, pending);
    effCols.forEach((ec) => {
      const col = sheet.columns[ec.index];
      columns.push({
        sheet: sheet.name,
        letter: col.letter,
        label: col.label,
        status: ec.status,
        productId: ec.productId,
        filledCells: sheet.rows.filter((r) => r.cells[ec.index].k !== "VAZIO").length,
      });
      if (ec.productId && !col.unit) needsUnitConfirmation = true;
    });

    for (const row of sheet.rows) {
      const rk = rowKey(sheet.name, row.row);
      let schoolId: string | null = null;
      const decided = rk in decisions.rowSchool ? decisions.rowSchool[rk] : undefined;
      let rowExcluded = false;
      if (decided === null) rowExcluded = true;
      else if (decided !== undefined && schools.has(decided)) schoolId = decided;
      else if (row.school.k === "OK") schoolId = row.school.schoolId;
      else {
        const who = row.rawName ? ` (${row.rawName})` : "";
        if (row.school.k === "NOME_DIVERGENTE") {
          const ours = schools.get(row.school.schoolId);
          pending.push({
            kind: "ESCOLA_NOME_DIVERGENTE",
            sheet: sheet.name,
            where: `linha ${row.row}`,
            key: rk,
            message: `Código ${row.rawCode} é "${ours?.name}" no cadastro, mas o arquivo diz "${row.rawName}". Confirme que é a mesma escola ou exclua a linha.`,
            blocking: false,
          });
        } else if (row.school.k === "DESCONHECIDA") {
          pending.push({
            kind: "ESCOLA_DESCONHECIDA",
            sheet: sheet.name,
            where: `linha ${row.row}`,
            key: rk,
            message: `Código ${row.rawCode}${who} não existe no cadastro. Associe a uma escola ou exclua a linha.`,
            blocking: false,
          });
        } else {
          pending.push({
            kind: "CODIGO_ILEGIVEL",
            sheet: sheet.name,
            where: `linha ${row.row}`,
            key: rk,
            message: `Código ilegível ("${row.rawCode}", formatado como data?)${who}. Associe a uma escola ou exclua a linha.`,
            blocking: false,
          });
        }
      }

      if (schoolId) {
        schoolRowCounts.recognized++;
        rowsBySchool.set(schoolId, [...(rowsBySchool.get(schoolId) ?? []), rk]);
      } else if (rowExcluded) schoolRowCounts.excluded++;
      else schoolRowCounts.pending++;

      row.cells.forEach((cell, index) => {
        if (cell.k === "VAZIO") return;
        sourceCells++;
        const ec = effCols[index];
        const col = sheet.columns[index];
        if (!ec.productId) {
          if (ec.status === "EXCLUIDA_POR_DECISAO") excludedByDecisionCells++;
          else if (ec.status === "FORA_DA_OFERTA" || ec.status === "NAO_RECONHECIDA") outOfOfferCells++;
          else pendingCells++;
          return;
        }
        offeredCells++;
        if (rowExcluded) {
          excludedByDecisionCells++;
          return;
        }
        if (!schoolId) {
          pendingCells++;
          return;
        }
        const address = cellKey(sheet.name, col.letter, row.row);
        const value = resolveCell(cell, address, decisions, sheet.name, `${col.letter}${row.row}`, pending);
        if (value === "PENDENTE") {
          pendingCells++;
          return;
        }
        if (value === "EXCLUIDA") {
          excludedByDecisionCells++;
          return;
        }
        const lk = lineKey(schoolId, ec.productId);
        const bySource = contributions.get(lk) ?? new Map<string, Contribution[]>();
        bySource.set(rk, [...(bySource.get(rk) ?? []), { sheet: sheet.name, row: row.row, address, value }]);
        contributions.set(lk, bySource);
      });
    }
  }

  if (needsUnitConfirmation && !decisions.unitConfirmed) {
    pending.push({
      kind: "UNIDADE_NAO_CONFIRMADA",
      sheet: null,
      where: "cabeçalhos",
      key: "unidade",
      message: "As colunas de produto não informam unidade. Confirme que as quantidades estão na unidade do cadastro (kg). Nada é convertido.",
      blocking: true,
    });
  }

  // Escola em mais de uma linha (mesma aba ou abas diferentes).
  const duplicatedSchools = new Set<string>();
  for (const [schoolId, rks] of rowsBySchool) {
    if (rks.length < 2) continue;
    const choice = decisions.duplicateSchool[schoolId];
    if (choice === "SOMAR" || (choice && choice !== "EXCLUIR" && rks.includes(choice))) continue;
    duplicatedSchools.add(schoolId);
    if (choice !== "EXCLUIR") {
      const s = schools.get(schoolId);
      pending.push({
        kind: "ESCOLA_DUPLICADA",
        sheet: null,
        where: rks.join("; "),
        key: schoolId,
        message: `${s?.code} ${s?.name} aparece em ${rks.length} linhas (${rks.join("; ")}). Escolha uma linha, some as ocorrências (se forem atendimentos diferentes da mesma escola) ou exclua.`,
        blocking: false,
      });
    }
  }

  const lines: PlanLine[] = [];
  for (const [lk, bySource] of contributions) {
    const [schoolId, productId] = lk.split(":");
    let chosen: Contribution[];
    if (duplicatedSchools.has(schoolId)) {
      const count = [...bySource.values()].flat().length;
      if (decisions.duplicateSchool[schoolId] === "EXCLUIR") excludedByDecisionCells += count;
      else pendingCells += count;
      continue;
    }
    const choice = decisions.duplicateSchool[schoolId];
    if (choice && choice !== "SOMAR" && choice !== "EXCLUIR" && (rowsBySchool.get(schoolId)?.length ?? 0) > 1) {
      chosen = bySource.get(choice) ?? [];
      const dropped = [...bySource.entries()].filter(([k]) => k !== choice).flatMap(([, v]) => v).length;
      excludedByDecisionCells += dropped;
      if (chosen.length === 0) continue;
    } else {
      chosen = [...bySource.values()].flat();
    }
    const newQty = round2(chosen.reduce((s, c) => s + c.value, 0));
    const currentQty = lk in ctx.existingOrders ? ctx.existingOrders[lk] : null;
    let change: LineChange;
    if (currentQty === null) change = newQty === 0 ? "SEM_MUDANCA" : "NOVO";
    else if (currentQty === newQty) change = "SEM_MUDANCA";
    else if (newQty === 0) change = "ZERAR";
    else change = "ALTERACAO";

    if (decisions.excludedLines[lk]) {
      excludedByDecisionCells += chosen.length;
      continue;
    }
    importedCells += chosen.length;
    const returned = ctx.existingReturns[lk] ?? 0;
    if (change !== "SEM_MUDANCA" && newQty < returned) {
      const s = schools.get(schoolId);
      const p = products.get(productId);
      pending.push({
        kind: "ABAIXO_DA_DEVOLUCAO",
        sheet: null,
        where: chosen.map((c) => c.address).join(", "),
        key: lk,
        message: `${s?.code} ${s?.name} / ${p?.name}: o pedido importado (${newQty}) ficaria menor que a devolução já lançada (${returned}). Corrija a devolução antes ou exclua este item.`,
        blocking: true,
      });
    }
    lines.push({ schoolId, productId, newQty, currentQty, change, sources: chosen.map((c) => c.address) });
  }
  lines.sort((a, b) => lineSortKey(a, schools, products).localeCompare(lineSortKey(b, schools, products)));

  const changes: Record<LineChange, number> = { NOVO: 0, ALTERACAO: 0, ZERAR: 0, SEM_MUDANCA: 0 };
  for (const l of lines) changes[l.change]++;
  const toWrite = lines.filter((l) => l.change !== "SEM_MUDANCA");

  const confirmBlockers: string[] = [];
  if (selected.length === 0) confirmBlockers.push("Selecione pelo menos uma aba com pedidos.");
  const blocking = pending.filter((p) => p.blocking);
  if (blocking.length) confirmBlockers.push(`${blocking.length} pendência(s) obrigatória(s) sem solução.`);
  if (toWrite.length === 0) confirmBlockers.push("Nenhum pedido a gravar (nada novo ou alterado).");
  const partial = pending.length - blocking.length > 0 || excludedByDecisionCells > 0 || pendingCells > 0;
  if (partial && !decisions.acknowledgeExclusions) {
    confirmBlockers.push("Há itens que não serão importados: confirme que está ciente da importação parcial.");
  }

  return {
    lines,
    pending,
    columns,
    reconciliation: {
      selectedSheets: selected.map((s) => s.name),
      sourceCells,
      outOfOfferCells,
      offeredCells,
      pendingCells,
      excludedByDecisionCells,
      importedCells,
      confirmedLines: toWrite.length,
      confirmedQty: round2(toWrite.reduce((s, l) => s + l.newQty, 0)),
      changes,
      schoolRows: schoolRowCounts,
    },
    canConfirm: confirmBlockers.length === 0,
    confirmBlockers,
  };
}

function resolveCell(
  cell: Exclude<CellParse, { k: "VAZIO" }>,
  address: string,
  decisions: ImportDecisions,
  sheet: string,
  where: string,
  pending: PendingItem[],
): number | "PENDENTE" | "EXCLUIDA" {
  const decided = address in decisions.cellValue ? decisions.cellValue[address] : undefined;
  switch (cell.k) {
    case "OK":
      return cell.v;
    case "PRECISAO":
      if (decisions.acceptRounding) return cell.rounded;
      if (decided === null) return "EXCLUIDA";
      pending.push({
        kind: "CELULA_PRECISAO",
        sheet,
        where,
        key: address,
        message: `${cell.original} tem mais de 2 casas decimais; seria gravado como ${cell.rounded}. Aceite a regra de arredondamento ou exclua.`,
        blocking: false,
      });
      return "PENDENTE";
    case "AMBIGUO":
      if (decided === null) return "EXCLUIDA";
      if (decided !== undefined && cell.options.includes(decided)) return decided;
      pending.push({
        kind: "CELULA_AMBIGUA",
        sheet,
        where,
        key: address,
        message: `"${cell.text}" pode ser ${cell.options[0]} ou ${cell.options[1]}. Escolha o valor correto ou exclua.`,
        blocking: false,
      });
      return "PENDENTE";
    case "INVALIDO":
      if (decided === null) return "EXCLUIDA";
      pending.push({ kind: "CELULA_INVALIDA", sheet, where, key: address, message: `"${cell.text}": ${cell.reason}`, blocking: false });
      return "PENDENTE";
  }
}

function lineSortKey(line: PlanLine, schools: Map<string, CatalogSchool>, products: Map<string, CatalogProduct>): string {
  return `${schools.get(line.schoolId)?.code.padStart(8, "0")}|${products.get(line.productId)?.name}`;
}

// Representação estável das linhas a gravar, usada para o servidor confirmar
// que grava exatamente o que foi mostrado na prévia.
export function planSignature(plan: ImportPlan): string {
  return plan.lines
    .filter((l) => l.change !== "SEM_MUDANCA")
    .map((l) => `${l.schoolId}:${l.productId}=${l.newQty}<${l.currentQty ?? "-"}`)
    .join("|");
}
