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
  if (!user || !user.active) {
    return { error: "Email ou senha invalidos." };
  }

  const passwordOk = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!passwordOk) {
    return { error: "Email ou senha invalidos." };
  }

  await createSession({ userId: user.id, name: user.name, email: user.email, role: user.role });
  redirect("/");
}
