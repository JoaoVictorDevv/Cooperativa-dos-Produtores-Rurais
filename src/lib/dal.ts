import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getSession } from "./session";
import { prisma } from "./prisma";
import type { Role } from "@prisma/client";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

// Checagem "segura": nao confia apenas no papel gravado no cookie —
// busca o usuario no banco a cada requisicao (memoizado via cache()) para
// que uma desativacao/mudanca de papel feita pelo ADMIN valha imediatamente.
export const verifySession = cache(async (): Promise<AuthUser> => {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || !user.active) {
    redirect("/login");
  }

  return { id: user.id, name: user.name, email: user.email, role: user.role };
});

// Uso: `await requireRole(["ADMIN"])` dentro de uma Server Action antes de
// qualquer mutacao critica. CONSULTA nunca deve passar por aqui em uma
// acao de escrita (CA-USR-02).
export async function requireRole(roles: Role[]): Promise<AuthUser> {
  const user = await verifySession();
  if (!roles.includes(user.role)) {
    throw new Error(`Acao nao permitida para o papel ${user.role}`);
  }
  return user;
}

export async function requireOperator(): Promise<AuthUser> {
  return requireRole(["ADMIN", "OPERADOR"]);
}
