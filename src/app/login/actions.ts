"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/session";

const LoginSchema = z.object({
  email: z.string().trim().min(1, "Informe o email"),
  password: z.string().min(1, "Informe a senha"),
});

// Hash bcrypt (custo 10) de um texto aleatório descartado; nunca corresponde a senha alguma.
const DUMMY_HASH = "$2b$10$CwTycUXWue0Thq9StjUM0uJ8.Qh1Y4vWjs0G5Df6hR3VrZVI2mO6y";

export interface LoginState {
  error?: string;
}

export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "Preencha email e senha." };
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  // Compara sempre (com um hash fictício quando o usuário não existe ou está
  // inativo) para o tempo de resposta não revelar quais emails têm conta.
  const passwordOk = await bcrypt.compare(parsed.data.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !user.active || !passwordOk) {
    return { error: "Email ou senha invalidos." };
  }

  await createSession({ userId: user.id, name: user.name, email: user.email, role: user.role });
  redirect("/painel");
}
