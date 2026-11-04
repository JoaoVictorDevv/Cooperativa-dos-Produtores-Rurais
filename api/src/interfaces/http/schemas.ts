import { z } from "zod";

export const id = z.uuid();
export const organizationParams = z.object({ organizationId: id });
export const weekParams = organizationParams.extend({ weekId: id });

const optionalText = z.string().trim().max(240).nullable().optional();

export const catalogSchemas = {
  products: z.object({ slug: z.string().trim().min(2).max(100), name: z.string().trim().min(2).max(140), unit: z.enum(["kg", "dz"]), active: z.boolean().default(true) }),
  schools: z.object({ code: z.string().trim().min(1).max(40), name: z.string().trim().min(2).max(180), neighborhood: optionalText, address: optionalText, phone: optionalText, active: z.boolean().default(true) }),
  producers: z.object({ internal_id: z.string().trim().min(1).max(40), name: z.string().trim().min(2).max(180), document: optionalText, phone: optionalText, active: z.boolean().default(true) }),
  return_reasons: z.object({ code: z.coerce.number().int().positive(), description: z.string().trim().min(3).max(180), active: z.boolean().default(true) }),
};

export const weekInput = z.object({
  reference_date: z.iso.date(),
  start_date: z.iso.date(),
  end_date: z.iso.date(),
  notes: z.string().max(1000).nullable().optional(),
});

export const memberInput = z.object({
  user_id: id,
  role: z.enum(["ADMIN", "OPERADOR", "CONSULTA"]),
  active: z.boolean().default(true),
});

export const priceInput = z.object({
  productId: id,
  price: z.number().min(0).max(999_999.99),
  validFrom: z.iso.date(),
});

export const productionMapInput = z.object({
  producer_id: id,
  product_id: id,
  cycle_year: z.number().int().min(2020).max(2200),
  month: z.number().int().min(1).max(12),
  offered_qty: z.number().min(0).max(99_999_999.99),
});

export const schoolOrderInput = z.object({
  school_id: id,
  product_id: id,
  ordered_qty: z.number().min(0).max(99_999_999.99),
  unit_price_snapshot: z.number().min(0).max(999_999.99),
});

export const producerOrderInput = z.object({
  producer_id: id,
  product_id: id,
  ordered_qty: z.number().min(0).max(99_999_999.99),
  unit_price_snapshot: z.number().min(0).max(999_999.99),
  logistics_deduction_snapshot: z.number().min(0).max(999_999.99),
});

export const weeklyCostInput = z.object({
  category: z.string().trim().min(2).max(80),
  amount: z.number().min(0).max(99_999_999.99),
  description: z.string().trim().max(500).nullable().optional(),
});

export const warehouseReceiptInput = z.object({
  producerId: id,
  productId: id,
  grossQty: z.number().min(0).max(99_999_999.99).nullable(),
  rejectedQty: z.number().min(0).max(99_999_999.99),
  rejectionReasonId: id.nullable().optional(),
  unitPriceSnapshot: z.number().min(0).max(999_999.99),
  logisticsDeductionSnapshot: z.number().min(0).max(999_999.99),
  deliveredAt: z.iso.datetime({ offset: true }).nullable().optional(),
  idempotencyKey: z.string().trim().min(8).max(100),
});

const eventFields = {
  presentedQty: z.number().min(0).max(99_999_999.99).nullable(),
  rejectedQty: z.number().min(0).max(99_999_999.99),
  rejectionReasonId: id.nullable().optional(),
  lossBeforeSchoolQty: z.number().min(0).max(99_999_999.99).default(0),
  lossReasonId: id.nullable().optional(),
  deliveredAt: z.iso.datetime({ offset: true }).nullable().optional(),
  receivedBy: z.string().trim().max(180).nullable().optional(),
};

const source = z.discriminatedUnion("type", [
  z.object({ type: z.literal("PRODUTOR"), producerId: id }),
  z.object({ type: z.literal("SALDO_GALPAO") }),
]);

export const cycleCommand = z.discriminatedUnion("type", [
  z.object({ type: z.literal("REGISTRAR_ENTREGA_INICIAL"), idempotencyKey: z.string().min(8).max(100), schoolId: id, productId: id, ...eventFields, source: source.nullable().optional() }),
  z.object({ type: z.literal("REGISTRAR_COMPLEMENTO"), idempotencyKey: z.string().min(8).max(100), schoolId: id, productId: id, ...eventFields, source, trip: z.enum(["MESMA_VIAGEM", "OUTRA_VIAGEM"]) }),
  z.object({ type: z.literal("CORRIGIR_EVENTO"), eventId: id, expectedVersion: z.number().int().positive(), changes: z.record(z.string(), z.unknown()), reason: z.string().trim().min(3).max(240) }),
  z.object({ type: z.literal("MARCAR_FALTA_EM_RESOLUCAO"), schoolId: id, productId: id, reason: z.string().trim().max(240).optional(), expectedVersion: z.number().int().positive().nullable() }),
  z.object({ type: z.literal("ENCERRAR_FALTA_SEM_ATENDIMENTO"), schoolId: id, productId: id, reason: z.string().trim().min(3).max(240), expectedShortageQty: z.number().min(0), expectedVersion: z.number().int().positive().nullable() }),
  z.object({ type: z.literal("REVOGAR_DECISAO_FALTA"), schoolId: id, productId: id, reason: z.string().trim().min(3).max(240), expectedVersion: z.number().int().positive() }),
]);
