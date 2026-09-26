// Validação do registro do ciclo recebido do navegador pela demonstração
// (rotas /api/demonstracao/documentos/*). O servidor não confia no que chega:
// limita tamanhos, formatos e números antes de montar qualquer documento.
// Nada disso é gravado.

import { z } from "zod";
import type { CycleLedger } from "../domain/cycleLedger";

const id = z.string().regex(/^[\w.:-]{1,64}$/);
const text = z.string().max(200);
const qty = z.number().finite().min(0).max(10_000_000);
const unit = z.enum(["kg", "dz"]);
const source = z.union([z.object({ type: z.literal("PRODUTOR"), producerId: id }), z.object({ type: z.literal("SALDO_GALPAO") })]);

const ledgerSchema = z.object({
  cycleId: id,
  status: z.enum(["ABERTO", "FECHADO"]),
  orders: z.array(z.object({ schoolId: id, productId: id, orderedQty: qty, unit, price: qty.nullable() })).max(5000),
  warehouseReceipts: z
    .array(
      z.object({
        producerId: id,
        productId: id,
        grossQty: qty.nullable(),
        rejectedQty: qty,
        unit: unit.optional(),
        price: qty.optional(),
        logisticsDeductionSnapshot: qty.optional(),
      }),
    )
    .max(5000),
  events: z
    .array(
      z.object({
        id,
        kind: z.enum(["INICIAL", "COMPLEMENTO"]),
        schoolId: id,
        productId: id,
        presentedQty: qty.nullable(),
        rejectedQty: qty,
        rejectionReason: text.nullable(),
        lossBeforeSchoolQty: qty,
        lossReason: text.nullable(),
        source: source.nullable(),
        deliveredAt: z.string().max(40).nullable(),
        receivedBy: text.nullable(),
        idempotencyKey: z.string().max(100),
        version: z.number().int().min(1),
        createdBy: text,
        createdAt: z.string().max(40),
      }),
    )
    .max(20000),
  decisions: z
    .array(
      z.object({
        schoolId: id,
        productId: id,
        kind: z.enum(["EM_RESOLUCAO", "ENCERRADA_SEM_ATENDIMENTO"]),
        reason: text,
        shortageQtyAtDecision: qty.nullable(),
        decidedBy: text,
        decidedAt: z.string().max(40),
        version: z.number().int().min(1),
      }),
    )
    .max(5000),
});

// A auditoria não entra nos documentos: é descartada na validação.
export function parseLedger(input: unknown): CycleLedger | null {
  const r = ledgerSchema.safeParse(input);
  return r.success ? { ...r.data, audit: [] } : null;
}
