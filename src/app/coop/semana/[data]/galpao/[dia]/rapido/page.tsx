import { notFound } from "next/navigation";
import { datasDoGalpao } from "@/lib/coop/semana";
import { diaDaEscala, escalaDe } from "@/lib/coop/escala";
import { carregarSemana } from "../../../../../dados";
import { cartoesDoGalpao } from "../cartoes";
import { ModoGalpao } from "./ModoGalpao";

export const metadata = { title: "Modo galpão" };

// Tela do celular para o domingo e a segunda: um produtor por vez, botões grandes.
export default async function PaginaModoGalpao({ params }: PageProps<"/coop/semana/[data]/galpao/[dia]/rapido">) {
  const { data, dia } = await params;
  if (dia !== "1" && dia !== "2") notFound();
  const { cad, sem, r } = await carregarSemana(data);
  const nomeDia = sem.diasGalpao[dia === "1" ? 0 : 1];
  const escalados = diaDaEscala(escalaDe(cad), nomeDia)?.pessoas.map((p) => p.nome.trim()).filter(Boolean) ?? [];
  const equipe = [...new Set([...escalados, ...(cad.equipe ?? [])])];
  return (
    <ModoGalpao
      data={data}
      dia={dia}
      titulo={`${nomeDia.charAt(0)}${nomeDia.slice(1).toLowerCase()} ${datasDoGalpao(sem)[dia === "1" ? 0 : 1].slice(0, 5)}`}
      outroDia={{ dia: dia === "1" ? "2" : "1", nome: sem.diasGalpao[dia === "1" ? 1 : 0].toLowerCase() }}
      cartoes={cartoesDoGalpao(cad, sem, r, dia)}
      caixa={cad.pesoCaixa}
      equipe={equipe}
    />
  );
}
