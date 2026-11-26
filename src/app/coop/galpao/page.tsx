import { redirect } from "next/navigation";
import { listarSemanas, lerSemana } from "@/lib/coop/armazem";
import { datasDoGalpao } from "@/lib/coop/semana";

export const dynamic = "force-dynamic";

const paraIso = (br: string) => `${br.slice(6, 10)}-${br.slice(3, 5)}-${br.slice(0, 2)}`;

// Atalho do celular: abre o galpão da semana certa no dia certo.
// Hoje é dia de galpão de alguma semana → esse dia. Senão, o próximo dia de galpão.
export default async function Galpao() {
  const hoje = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
  const semanas = await listarSemanas(); // da mais nova para a mais velha
  const opcoes: { data: string; dia: string; quando: string }[] = [];
  for (const data of semanas) {
    const sem = await lerSemana(data);
    if (sem) datasDoGalpao(sem).forEach((br, i) => opcoes.push({ data, dia: String(i + 1), quando: paraIso(br) }));
  }
  const proxima = opcoes.filter((o) => o.quando >= hoje).sort((a, b) => a.quando.localeCompare(b.quando))[0];
  if (proxima) redirect(`/coop/semana/${proxima.data}/galpao/${proxima.dia}/rapido`);
  if (semanas.length) redirect(`/coop/semana/${semanas[0]}/galpao/1/rapido`);
  redirect("/coop");
}
