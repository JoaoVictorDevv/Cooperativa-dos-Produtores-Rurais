import { prisma } from "./prisma";
import type { Prisma, PrismaClient } from "@prisma/client";

interface WriteAuditParams {
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  reason?: string;
}

// Registro generico de auditoria (secao 49-50). Chamado por toda action
// que cria, altera ou fecha/reabre algo relevante.
export async function writeAudit(
  params: WriteAuditParams,
  client: PrismaClient | Prisma.TransactionClient = prisma,
) {
  await client.auditLog.create({
    data: {
      userId: params.userId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      before: serialize(params.before),
      after: serialize(params.after),
      reason: params.reason,
    },
  });
}

function serialize(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  // Decimal/Date do Prisma nao serializam direto em JSON — passar por
  // JSON.stringify/parse normaliza tudo para tipos simples.
  return JSON.parse(JSON.stringify(value));
}
