"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_ACESSO, iguais, lerAcesso, valorCookie } from "@/lib/coop/acesso";

// Trava simples: 10 PINs errados seguidos = espera 10 minutos.
let erros = 0;
let travadoAte = 0;

export async function entrar(_: { erro: string } | null, form: FormData): Promise<{ erro: string }> {
  if (Date.now() < travadoAte) return { erro: "Muitas tentativas erradas. Espere 10 minutos." };
  const pin = String(form.get("pin") ?? "").trim();
  const voltaBruta = String(form.get("volta") ?? "");
  const volta = voltaBruta.startsWith("/coop") && !voltaBruta.startsWith("//") ? voltaBruta : "/coop";
  const acesso = await lerAcesso(true);
  if (!acesso || !pin || !iguais(pin, acesso.pin)) {
    erros++;
    if (erros >= 10) {
      travadoAte = Date.now() + 10 * 60 * 1000;
      erros = 0;
    }
    await new Promise((r) => setTimeout(r, 800));
    return { erro: "PIN errado. Tente de novo." };
  }
  erros = 0;
  (await cookies()).set({ name: COOKIE_ACESSO, value: valorCookie(acesso.segredo), httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  redirect(volta);
}
