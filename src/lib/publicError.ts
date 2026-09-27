import { Prisma } from "@prisma/client";
import { ZodError } from "zod";

// Mensagem de erro que pode ir para o navegador (revisão de segurança,
// 27/09/2026). Erros de regra de negócio (lançados pelo próprio app, com texto
// pensado para o usuário) passam como estão. Erros internos do Prisma/banco
// podem trazer nomes de tabela, colunas, valores ou trechos de consulta:
// viram uma mensagem genérica; só o código técnico vai para o log do servidor.
const PRISMA_ERRORS = [
  Prisma.PrismaClientKnownRequestError,
  Prisma.PrismaClientUnknownRequestError,
  Prisma.PrismaClientValidationError,
  Prisma.PrismaClientInitializationError,
  Prisma.PrismaClientRustPanicError,
];

export function publicErrorMessage(err: unknown, fallback: string): string {
  if (!(err instanceof Error)) return fallback;
  // Validação (zod): a mensagem crua é um JSON técnico; mostra só a primeira regra violada.
  if (err instanceof ZodError) return err.issues[0]?.message ?? fallback;
  if (!PRISMA_ERRORS.some((E) => err instanceof E)) return err.message;
  // Gatilhos do banco com texto para o usuário (migrations: semana fechada).
  if (/Semana fechada nao pode receber alteracoes/.test(err.message)) return "Semana fechada não pode receber alterações.";
  if (/Semana operacional inexistente/.test(err.message)) return "Semana não encontrada.";
  const code = err instanceof Prisma.PrismaClientKnownRequestError ? err.code : err.name;
  if (code === "P2002") return "Este registro já existe (provavelmente salvo por outra pessoa). Recarregue a página.";
  if (code === "P2025") return "Registro não encontrado (pode ter sido alterado por outra pessoa). Recarregue a página.";
  console.error(`[erro interno do banco] ${code}`);
  return `${fallback} (erro interno registrado).`;
}
