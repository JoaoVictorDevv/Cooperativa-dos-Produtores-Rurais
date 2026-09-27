// Contrato dos comandos do núcleo (complementos e faltas) em zod — fonte do
// JSON Schema entregue ao Lucas (docs/aceitacao/contrato-comandos.schema.json)
// e validação de entrada para quando os comandos chegarem pelo servidor.
// Deve aceitar exatamente os tipos CycleCommand/CommandResult de cycleLedger.ts.

import { z } from "zod";

const id = z.string().min(1).max(64);
const text = z.string().max(200);
const qty = z.number().min(0).max(99_999_999.99);
const source = z.union([z.object({ type: z.literal("PRODUTOR"), producerId: id }), z.object({ type: z.literal("SALDO_GALPAO") })]);
const trip = z
  .enum(["MESMA_VIAGEM", "OUTRA_VIAGEM"])
  .describe(
    "RN-22. MESMA_VIAGEM: foi na mesma carga da entrega inicial → um romaneio só; a entrega inicial registra o TOTAL do romaneio e este registro guarda só a origem (sem rejeição, perda, deliveredAt ou receivedBy próprios; não soma de novo no entregue à escola). OUTRA_VIAGEM: nova entrega física, com romaneio próprio.",
  );

const eventFields = {
  presentedQty: qty.nullable().describe("Quantidade apresentada à escola. null = não informado (pendente); 0 = zero confirmado."),
  rejectedQty: qty.describe("Rejeitado pela escola (perda da cooperativa)."),
  rejectionReason: text.nullable().optional().describe("Obrigatório quando rejectedQty > 0."),
  lossBeforeSchoolQty: qty.optional().describe("Perda antes de chegar à escola (transporte/manuseio). Não é rejeição."),
  lossReason: text.nullable().optional().describe("Obrigatório quando lossBeforeSchoolQty > 0."),
  deliveredAt: z.string().max(40).nullable().optional().describe("Data e hora REAIS da entrega (romaneio), não a do lançamento."),
  receivedBy: text.nullable().optional(),
};

export const commandSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("REGISTRAR_ENTREGA_INICIAL"),
    idempotencyKey: z.string().min(1).max(100),
    schoolId: id,
    productId: id,
    ...eventFields,
    presentedQty: eventFields.presentedQty.describe(
      "Total entregue à escola nesta visita (linha do romaneio), inclusive o que veio de complemento na mesma viagem. null = não informado (pendente); 0 = zero confirmado.",
    ),
    source: source.nullable().optional(),
  }),
  z.object({
    type: z.literal("REGISTRAR_COMPLEMENTO"),
    idempotencyKey: z.string().min(1).max(100),
    schoolId: id,
    productId: id,
    ...eventFields,
    source: source.describe("Obrigatório: de onde veio o produto."),
    trip: trip.describe("Obrigatório, sem padrão. " + trip.description),
  }),
  z.object({
    type: z.literal("CORRIGIR_EVENTO"),
    eventId: id,
    expectedVersion: z.number().int().min(1).describe("Versão vista na tela; diferente da atual → CONFLITO."),
    changes: z
      .object(eventFields)
      .partial()
      .extend({ source: source.nullable().optional(), trip: trip.nullable().optional().describe("Só em complemento. " + trip.description) }),
    reason: text.min(1),
  }),
  z.object({ type: z.literal("MARCAR_FALTA_EM_RESOLUCAO"), schoolId: id, productId: id, reason: text.optional(), expectedVersion: z.number().int().min(1).nullable() }),
  z.object({
    type: z.literal("ENCERRAR_FALTA_SEM_ATENDIMENTO"),
    schoolId: id,
    productId: id,
    reason: text.min(3),
    expectedShortageQty: qty.describe("Falta mostrada na tela; diferente da atual → CONFLITO."),
    expectedVersion: z.number().int().min(1).nullable(),
  }),
  z.object({ type: z.literal("REVOGAR_DECISAO_FALTA"), schoolId: id, productId: id, reason: text.min(1), expectedVersion: z.number().int().min(1) }),
]);

export const commandResultSchema = z.union([
  z.object({
    ok: z.literal(true),
    effect: z.enum(["APLICADO", "JA_REGISTRADO"]).describe("JA_REGISTRADO = reenvio com a mesma idempotencyKey e os mesmos dados; nada muda."),
    warnings: z.array(z.string()),
  }),
  z.object({
    ok: z.literal(false),
    code: z.enum(["CICLO_FECHADO", "SEM_PERMISSAO", "INVALIDO", "CONFLITO", "NAO_ENCONTRADO"]),
    error: z.string(),
  }),
]);
