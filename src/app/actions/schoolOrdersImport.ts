"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { round2 } from "@/lib/calc";
import { requireOperator } from "@/lib/dal";
import { assertWeekEditable, getCurrentPrice } from "@/lib/week";
import { productUnit } from "@/lib/format";
import { isOfferedForNewEntries } from "@/lib/productPolicy";
import { readXlsx } from "@/lib/import/xlsx";
import { readPdf } from "@/lib/import/pdf";
import { parseSheet } from "@/lib/import/parseSheet";
import { buildImportPlan, lineKey, planSignature, type ImportDecisions, type PlanContext } from "@/lib/import/plan";
import type { ParsedWorkbook, RawWorkbook } from "@/lib/import/types";

// Mesmo valor de experimental.serverActions.bodySizeLimit (next.config.ts),
// com folga para o envelope multipart.
const MAX_FILE_BYTES = 7 * 1024 * 1024;

export interface ImportWeekInfo {
  id: string;
  number: number;
  startDate: string;
  endDate: string;
}

export interface PreviewResult {
  ok: boolean;
  error?: string;
  parsed?: ParsedWorkbook;
  context?: PlanContext;
  week?: ImportWeekInfo;
}

async function readUpload(file: File): Promise<RawWorkbook> {
  if (file.size === 0) throw new Error("O arquivo está vazio.");
  if (file.size > MAX_FILE_BYTES) throw new Error("Arquivo maior que 7 MB. Envie só a planilha do pedido.");
  const name = file.name.toLowerCase();
  const buffer = await file.arrayBuffer();
  if (name.endsWith(".xlsx")) {
    try {
      return await readXlsx(buffer, file.name);
    } catch {
      throw new Error("Não consegui ler este arquivo como Excel (.xlsx). Se for .xls antigo, salve como .xlsx.");
    }
  }
  if (name.endsWith(".pdf")) return readPdf(buffer, file.name);
  throw new Error("Formato não suportado. Envie .xlsx ou .pdf com texto.");
}

async function loadContext(weekId: string): Promise<PlanContext> {
  const [schools, products, orders, returns] = await Promise.all([
    prisma.school.findMany({ where: { active: true }, select: { id: true, code: true, name: true }, orderBy: { code: "asc" } }),
    prisma.product.findMany({ select: { id: true, slug: true, name: true, active: true }, orderBy: { name: "asc" } }),
    prisma.schoolOrder.findMany({ where: { weekId }, select: { schoolId: true, productId: true, orderedQty: true } }),
    prisma.schoolReturn.findMany({ where: { weekId }, select: { schoolId: true, productId: true, returnedQty: true } }),
  ]);
  const existingOrders: Record<string, number> = {};
  for (const o of orders) existingOrders[lineKey(o.schoolId, o.productId)] = Number(o.orderedQty);
  const existingReturns: Record<string, number> = {};
  for (const r of returns) {
    const key = lineKey(r.schoolId, r.productId);
    existingReturns[key] = (existingReturns[key] ?? 0) + Number(r.returnedQty);
  }
  return {
    schools,
    products: products.map((p) => ({ id: p.id, slug: p.slug, name: p.name, unit: productUnit(p.slug), offered: isOfferedForNewEntries(p) })),
    existingOrders,
    existingReturns,
  };
}

function parseWorkbook(raw: RawWorkbook, ctx: PlanContext): ParsedWorkbook {
  return { fileName: raw.fileName, source: raw.source, sheets: raw.sheets.map((s) => parseSheet(s, ctx.schools, ctx.products)) };
}

async function loadEditableWeek(weekId: unknown) {
  if (typeof weekId !== "string" || !weekId) throw new Error("Ciclo (semana) não informado.");
  const week = await prisma.week.findUnique({ where: { id: weekId } });
  if (!week) throw new Error("Semana não encontrada.");
  assertWeekEditable(week);
  return week;
}

// Passo 1: lê e reconhece o arquivo no servidor. Não grava nada.
export async function previewSchoolOrdersImport(formData: FormData): Promise<PreviewResult> {
  try {
    await requireOperator();
    const week = await loadEditableWeek(formData.get("weekId"));
    const file = formData.get("file");
    if (!(file instanceof File)) return { ok: false, error: "Selecione um arquivo (.xlsx ou .pdf)." };
    const raw = await readUpload(file);
    const context = await loadContext(week.id);
    return {
      ok: true,
      parsed: parseWorkbook(raw, context),
      context,
      week: { id: week.id, number: week.number, startDate: week.startDate.toISOString(), endDate: week.endDate.toISOString() },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erro ao ler o arquivo." };
  }
}

export interface ConfirmImportResult {
  ok: boolean;
  error?: string;
  written?: { created: number; updated: number; zeroed: number; qty: number };
}

function parseDecisions(value: FormDataEntryValue | null): ImportDecisions {
  if (typeof value !== "string") throw new Error("Decisões da conferência ausentes.");
  const d = JSON.parse(value) as Partial<ImportDecisions>;
  const record = (x: unknown) => (x && typeof x === "object" && !Array.isArray(x) ? x : {});
  return {
    selectedSheets: Array.isArray(d.selectedSheets) ? d.selectedSheets.filter((x): x is string => typeof x === "string") : [],
    columnProduct: record(d.columnProduct) as ImportDecisions["columnProduct"],
    unitConfirmed: d.unitConfirmed === true,
    acceptRounding: d.acceptRounding === true,
    rowSchool: record(d.rowSchool) as ImportDecisions["rowSchool"],
    duplicateSchool: record(d.duplicateSchool) as ImportDecisions["duplicateSchool"],
    cellValue: record(d.cellValue) as ImportDecisions["cellValue"],
    excludedLines: record(d.excludedLines) as ImportDecisions["excludedLines"],
    acknowledgeExclusions: d.acknowledgeExclusions === true,
  };
}

// Passo 2: relê o MESMO arquivo, reaplica as decisões com o cadastro e os
// pedidos atuais e só grava se o resultado for idêntico ao que foi mostrado
// na prévia. Tudo numa transação: ou entra tudo, ou nada.
export async function confirmSchoolOrdersImport(formData: FormData): Promise<ConfirmImportResult> {
  try {
    const user = await requireOperator();
    const week = await loadEditableWeek(formData.get("weekId"));
    const file = formData.get("file");
    if (!(file instanceof File)) return { ok: false, error: "Arquivo da prévia não reenviado." };
    const decisions = parseDecisions(formData.get("decisions"));
    const expectedSignature = formData.get("signature");

    const raw = await readUpload(file);
    const context = await loadContext(week.id);
    const plan = buildImportPlan(parseWorkbook(raw, context), decisions, context);
    if (!plan.canConfirm) return { ok: false, error: plan.confirmBlockers.join(" ") };
    if (planSignature(plan) !== expectedSignature) {
      return {
        ok: false,
        error: "Os pedidos ou o cadastro mudaram depois da prévia (outra pessoa pode ter editado). Gere a prévia de novo antes de gravar.",
      };
    }

    const toWrite = plan.lines.filter((l) => l.change !== "SEM_MUDANCA");
    for (const l of toWrite) {
      if (!(l.newQty >= 0) || Math.abs(round2(l.newQty) - l.newQty) > 1e-9) throw new Error("Quantidade fora da precisão aceita (2 casas).");
    }
    const productIds = [...new Set(toWrite.map((l) => l.productId))];
    const prices = new Map(await Promise.all(productIds.map(async (id) => [id, (await getCurrentPrice(id, week.referenceDate)).id] as const)));
    const reason = `Importado de "${raw.fileName}" (${raw.source === "pdf" ? "PDF" : "Excel"}; abas: ${plan.reconciliation.selectedSheets.join(", ")})`;

    const written = await prisma.$transaction(
      async (tx) => {
        const current = await tx.week.findUniqueOrThrow({ where: { id: week.id } });
        assertWeekEditable(current);
        const returns = await tx.schoolReturn.findMany({
          where: { weekId: week.id, schoolId: { in: [...new Set(toWrite.map((l) => l.schoolId))] } },
          select: { schoolId: true, productId: true, returnedQty: true },
        });
        const returnedByKey = new Map<string, number>();
        for (const r of returns) {
          const key = lineKey(r.schoolId, r.productId);
          returnedByKey.set(key, (returnedByKey.get(key) ?? 0) + Number(r.returnedQty));
        }
        const audits: { userId: string; action: string; entityType: string; entityId: string; before?: object; after: object; reason: string }[] = [];
        const counts = { created: 0, updated: 0, zeroed: 0, qty: 0 };

        for (const l of toWrite) {
          const key = lineKey(l.schoolId, l.productId);
          if (l.newQty < (returnedByKey.get(key) ?? 0)) {
            throw new Error("Uma devolução foi lançada depois da prévia e ficaria maior que o pedido importado. Gere a prévia de novo.");
          }
          if (l.currentQty === null) {
            const created = await tx.schoolOrder.create({
              data: { weekId: week.id, schoolId: l.schoolId, productId: l.productId, orderedQty: l.newQty, priceId: prices.get(l.productId)! },
            });
            counts.created++;
            audits.push({ userId: user.id, action: "SCHOOL_ORDER_IMPORT_CREATE", entityType: "SchoolOrder", entityId: created.id, after: { orderedQty: l.newQty, sources: l.sources }, reason });
          } else {
            // Atualiza só se o valor ainda é o que a prévia mostrou (edição concorrente aborta tudo).
            const existing = await tx.schoolOrder.findUniqueOrThrow({
              where: { weekId_schoolId_productId: { weekId: week.id, schoolId: l.schoolId, productId: l.productId } },
            });
            const changed = await tx.schoolOrder.updateMany({
              where: { id: existing.id, orderedQty: l.currentQty },
              data: { orderedQty: l.newQty },
            });
            if (changed.count !== 1) throw new Error("Um pedido foi alterado por outra pessoa depois da prévia. Gere a prévia de novo.");
            if (l.newQty === 0) counts.zeroed++;
            else counts.updated++;
            audits.push({
              userId: user.id,
              action: "SCHOOL_ORDER_IMPORT_UPDATE",
              entityType: "SchoolOrder",
              entityId: existing.id,
              before: { orderedQty: l.currentQty },
              after: { orderedQty: l.newQty, sources: l.sources },
              reason,
            });
          }
          counts.qty += l.newQty;
        }
        await tx.auditLog.createMany({ data: audits });
        return { ...counts, qty: Math.round(counts.qty * 100) / 100 };
      },
      { timeout: 120_000, maxWait: 10_000 },
    );

    revalidatePath("/escolas");
    revalidatePath(`/semanas/${week.id}`);
    return { ok: true, written };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erro ao gravar a importação." };
  }
}
