import type { ResultadoSemana } from "@/lib/coop/motor";
import type { Cadastro, Semana } from "@/lib/coop/tipos";
import type { CartaoProdutor } from "./Galpao";

// Um cartão por produtor que tem algo no dia (pedido, lançamento ou extra).
export function cartoesDoGalpao(cad: Cadastro, sem: Semana, r: ResultadoSemana, dia: "1" | "2"): CartaoProdutor[] {
  const campo = dia === "1" ? "planejado1" : "planejado2";
  const digitado = dia === "1" ? sem.entrega1 : sem.entrega2;
  return cad.produtores
    .map((p) => ({
      id: p.id,
      nome: p.nome,
      curto: p.curto,
      lancado: Boolean(digitado[p.id] && Object.keys(digitado[p.id]).length),
      recebimento: sem.recebimento?.[dia]?.[p.id] ?? null,
      itens: cad.produtos.map((pr) => ({
        produto: pr.nome,
        unidade: pr.unidade,
        planejado: r.produtores[p.id][pr.nome][campo],
        entregue: digitado[p.id]?.[pr.nome] ?? null,
        extra: sem.extra[p.id]?.[pr.nome] ?? null,
      })),
    }))
    .filter((c) => c.itens.some((i) => i.planejado > 0.004 || i.entregue !== null || i.extra !== null));
}
