"use server";

import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { requireOperator } from "@/lib/dal";
import { writeAudit } from "@/lib/audit";
import { assertWeekEditable, getCurrentPrice } from "@/lib/week";
import { qtySchema } from "@/lib/validation";
import { buildImportPreview, type CellValue, type ImportPreview } from "@/lib/importSchoolOrders";
import { revalidatePath } from "next/cache";

export interface PreviewResult {
  ok: boolean;
  error?: string;
  preview?: ImportPreview;
  sourceLabel?: string;
  existingOrders?: Record<string, number>;
}

function cellEffectiveValue(raw: ExcelJS.CellValue): CellValue {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "object") {
    if ("richText" in raw) return raw.richText.map((t) => t.text).join("");
    if ("result" in raw) return (raw.result as CellValue) ?? null;
    if ("text" in raw) return String(raw.text);
    if (raw instanceof Date) return raw.toISOString();
    return null;
  }
  return raw as CellValue;
}

function worksheetToMatrix(ws: ExcelJS.Worksheet): CellValue[][] {
  const matrix: CellValue[][] = [];
  ws.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const cells: CellValue[] = [];
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cells[colNumber - 1] = cellEffectiveValue(cell.value);
    });
    matrix[rowNumber - 1] = cells ?? [];
  });
  return matrix;
}

// Passo 1 do fluxo de importacao (plano §13): le e confere o arquivo no
// SERVIDOR (nunca confia em conferencia feita so no navegador), devolve
// uma previa pro operador revisar. Ainda NAO grava nada no banco.
export async function previewSchoolOrdersImport(formData: FormData): Promise<PreviewResult> {
  try {
    await requireOperator();
    const weekId = formData.get("weekId");
    const file = formData.get("file");
    if (typeof weekId !== "string" || !weekId) {
      return { ok: false, error: "Semana não informada." };
    }
    if (!(file instanceof File)) {
      return { ok: false, error: "Selecione um arquivo Excel (.xlsx)." };
    }

    const week = await prisma.week.findUniqueOrThrow({ where: { id: weekId } });
    assertWeekEditable(week);

    const buffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(buffer);
    } catch {
      return { ok: false, error: "Não consegui ler este arquivo como Excel (.xlsx). Verifique o formato." };
    }
    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return { ok: false, error: "A planilha não tem nenhuma aba." };
    }

    const [schools, products] = await Promise.all([
      prisma.school.findMany({ where: { active: true }, select: { id: true, code: true, name: true } }),
      // Inclui inativos tambem: precisamos reconhecer um produto retirado
      // do fluxo ativo (ex.: Ovos, plano §15) pelo nome pra avisar
      // especificamente, em vez de tratar a coluna como desconhecida.
      prisma.product.findMany({ select: { id: true, slug: true, name: true, active: true } }),
    ]);

    const matrix = worksheetToMatrix(worksheet);
    const result = buildImportPreview(matrix, schools, products);
    if ("error" in result) {
      return { ok: false, error: result.error };
    }

    const existingOrderRows = await prisma.schoolOrder.findMany({
      where: { weekId, orderedQty: { gt: 0 } },
      select: { schoolId: true, productId: true, orderedQty: true },
    });
    const existingOrders: Record<string, number> = {};
    for (const o of existingOrderRows) {
      existingOrders[`${o.schoolId}:${o.productId}`] = Number(o.orderedQty);
    }

    return { ok: true, preview: result, sourceLabel: file.name, existingOrders };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erro desconhecido ao ler o arquivo." };
  }
}

export interface ConfirmImportResult {
  ok: boolean;
  error?: string;
  savedCount?: number;
}

export interface ConfirmImportRow {
  schoolId: string;
  productId: string;
  orderedQty: number;
}

// Passo 2: o operador ja revisou a previa e confirmou. Revalida cada
// linha de novo no servidor (nunca confia no que veio do navegador) e
// grava tudo numa unica transacao — ou tudo entra, ou nada entra.
// Reaproveita as mesmas regras de saveSchoolOrder: preco congelado na
// criacao, e bloqueio se a quantidade importada for menor que uma
// devolucao ja lancada pra essa escola/produto.
export async function confirmSchoolOrdersImport(
  weekId: string,
  rows: ConfirmImportRow[],
  sourceLabel: string,
): Promise<ConfirmImportResult> {
  try {
    const user = await requireOperator();
    if (rows.length === 0) {
      return { ok: false, error: "Nenhuma linha reconhecida para importar." };
    }

    const week = await prisma.week.findUniqueOrThrow({ where: { id: weekId } });
    assertWeekEditable(week);

    const validatedRows = rows.map((r) => ({
      schoolId: r.schoolId,
      productId: r.productId,
      orderedQty: qtySchema.parse(r.orderedQty),
    }));

    await prisma.$transaction(async (tx) => {
      for (const row of validatedRows) {
        const [school, product] = await Promise.all([
          tx.school.findUniqueOrThrow({ where: { id: row.schoolId } }),
          tx.product.findUniqueOrThrow({ where: { id: row.productId } }),
        ]);

        const existingReturn = await tx.schoolReturn.findUnique({
          where: { weekId_schoolId_productId: { weekId, schoolId: row.schoolId, productId: row.productId } },
        });
        const existingReturnedQty = existingReturn ? Number(existingReturn.returnedQty) : 0;
        if (row.orderedQty < existingReturnedQty) {
          throw new Error(
            `Escola ${school.code} / ${product.name}: importação traria pedido (${row.orderedQty}) menor que a ` +
              `devolução já registrada (${existingReturnedQty}). Corrija a devolução antes ou remova esta linha da importação.`,
          );
        }

        const existing = await tx.schoolOrder.findUnique({
          where: { weekId_schoolId_productId: { weekId, schoolId: row.schoolId, productId: row.productId } },
        });
        const price = await getCurrentPrice(row.productId, week.referenceDate);
        const saved = await tx.schoolOrder.upsert({
          where: { weekId_schoolId_productId: { weekId, schoolId: row.schoolId, productId: row.productId } },
          update: { orderedQty: row.orderedQty },
          create: { weekId, schoolId: row.schoolId, productId: row.productId, orderedQty: row.orderedQty, priceId: price.id },
        });
        await writeAudit(
          {
            userId: user.id,
            action: existing ? "SCHOOL_ORDER_IMPORT_UPDATE" : "SCHOOL_ORDER_IMPORT_CREATE",
            entityType: "SchoolOrder",
            entityId: saved.id,
            before: existing,
            after: saved,
            reason: `Importado de "${sourceLabel}"`,
          },
          tx,
        );
      }
    });

    revalidatePath("/escolas");
    return { ok: true, savedCount: validatedRows.length };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erro desconhecido ao gravar a importação." };
  }
}
