import type { Prisma } from "@prisma/client";

// Cadastro inativo não recebe lançamento NOVO (revisão de segurança,
// 27/09/2026): antes só a tela escondia escolas/produtores inativos, e o
// servidor aceitava um lançamento enviado direto. Corrigir quantidade de um
// lançamento que já existe continua permitido (histórico preservado).
type Tx = Pick<Prisma.TransactionClient, "school" | "producer">;

export async function assertSchoolAcceptsNewEntries(tx: Tx, schoolId: string): Promise<void> {
  const school = await tx.school.findUniqueOrThrow({ where: { id: schoolId } });
  if (!school.active) throw new Error(`${school.name} está inativa: não recebe novos lançamentos (os antigos continuam no histórico).`);
}

export async function assertProducerAcceptsNewEntries(tx: Tx, producerId: string): Promise<void> {
  const producer = await tx.producer.findUniqueOrThrow({ where: { id: producerId } });
  if (!producer.active) throw new Error(`${producer.name} está inativo: não recebe novos lançamentos (os antigos continuam no histórico).`);
}
