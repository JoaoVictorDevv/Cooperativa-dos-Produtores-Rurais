import type { Prisma } from "@prisma/client";

// Trava de transação do Postgres (advisory lock) por linha lógica: ciclo ×
// escola/produtor × produto. Pedido/entrega e a devolução correspondente pegam
// a MESMA trava antes de ler e gravar, então a checagem "devolução ≤ pedido"
// (ou ≤ entrega) não pode ser furada por duas pessoas ao mesmo tempo
// (corrida reproduzida em src/lib/concurrency.integration.test.ts: 40 de 40).
// Liberada automaticamente no fim da transação. Não exige mudança de schema.
export async function lockLine(tx: Prisma.TransactionClient, kind: "escola" | "galpao", weekId: string, partyId: string, productId: string): Promise<void> {
  const key = `${kind}:${weekId}:${partyId}:${productId}`;
  await tx.$queryRaw`SELECT 1 AS ok FROM (SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))) AS l`;
}
