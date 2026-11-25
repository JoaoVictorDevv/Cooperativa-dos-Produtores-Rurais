import "server-only";

import { connection } from "next/server";
import { notFound } from "next/navigation";
import { lerCadastro, lerSemana, modoLocal } from "@/lib/coop/armazem";
import { calcularSemana } from "@/lib/coop/motor";
import { rotasComMotorista } from "@/lib/coop/motoristas";

// Tudo que as telas da semana precisam: cadastro, o que foi digitado e as contas.
export async function carregarSemana(data: string) {
  await connection();
  if (!modoLocal()) notFound();
  const [cad, sem] = await Promise.all([lerCadastro(), lerSemana(data)]);
  if (!cad || !sem) notFound();
  // Motorista de cada rota vem do Cadastro (muda sem mexer na semana).
  const semTela = { ...sem, rotas: rotasComMotorista(sem.rotas, cad) };
  return { cad, sem: semTela, r: calcularSemana(cad, sem) };
}

export async function carregarCadastro() {
  await connection();
  if (!modoLocal()) notFound();
  return lerCadastro();
}
