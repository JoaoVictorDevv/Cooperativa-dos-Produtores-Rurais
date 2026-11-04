import type { PrismaClient } from "@prisma/client";
import { checkDisposableMarker, type DisposableTarget } from "./disposableDb";

// Para testes de integração: confirma no próprio banco que ele é o descartável
// desta execução (nome + marca) e só então apaga os dados, na ordem das
// dependências. Cada arquivo de teste começa de um banco vazio.
export async function resetDisposableDb(prisma: PrismaClient, target: DisposableTarget, token: string): Promise<void> {
  const [row] = await prisma.$queryRaw<{ current_database: string; comment: string | null }[]>`
    SELECT current_database() AS current_database, shobj_description(d.oid, 'pg_database') AS comment
    FROM pg_database d WHERE d.datname = current_database()`;
  checkDisposableMarker(target, { currentDatabase: row.current_database, comment: row.comment }, token);
  await prisma.auditLog.deleteMany();
  await prisma.weekReopening.deleteMany();
  await prisma.producerReturn.deleteMany();
  await prisma.producerDelivery.deleteMany();
  await prisma.producerOrder.deleteMany();
  await prisma.producerAllocation.deleteMany();
  await prisma.schoolReturn.deleteMany();
  await prisma.schoolDelivery.deleteMany();
  await prisma.schoolOrder.deleteMany();
  await prisma.weeklyCost.deleteMany();
  await prisma.week.deleteMany();
  await prisma.price.deleteMany();
  await prisma.productionMapEntry.deleteMany();
  await prisma.returnReason.deleteMany();
  await prisma.school.deleteMany();
  await prisma.producer.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();
  await prisma.settings.deleteMany();
}
