import Link from "next/link";
import { notFound } from "next/navigation";
import { kg } from "@/lib/coop/numeros";
import { carregarSemana } from "../../../../dados";
import { Galpao, type CartaoProdutor } from "./Galpao";

export const metadata = { title: "Galpão" };

export default async function PaginaGalpao({ params }: PageProps<"/coop/semana/[data]/galpao/[dia]">) {
  const { data, dia } = await params;
  if (dia !== "1" && dia !== "2") notFound();
  const { cad, sem, r } = await carregarSemana(data);
  const campo = dia === "1" ? "planejado1" : "planejado2";
  const digitado = dia === "1" ? sem.entrega1 : sem.entrega2;
  const nomeDia = sem.diasGalpao[dia === "1" ? 0 : 1];
  const rotasDoDia = dia === "1" ? "rotas de segunda" : "rotas de terça";

  const cartoes: CartaoProdutor[] = cad.produtores
    .map((p) => ({
      id: p.id,
      nome: p.nome,
      curto: p.curto,
      lancado: Boolean(digitado[p.id] && Object.keys(digitado[p.id]).length),
      itens: cad.produtos.map((pr) => ({
        produto: pr.nome,
        unidade: pr.unidade,
        planejado: r.produtores[p.id][pr.nome][campo],
        entregue: digitado[p.id]?.[pr.nome] ?? null,
        extra: sem.extra[p.id]?.[pr.nome] ?? null,
      })),
    }))
    .filter((c) => c.itens.some((i) => i.planejado > 0.004 || i.entregue !== null || i.extra !== null));

  const faltas = cad.produtos
    .map((p) => {
      const e = r.entregaProduto[p.nome];
      const pedido = dia === "1" ? e.precisa1 : e.pedidoTer;
      const entregue = dia === "1" ? e.entregue1 : e.disponivel2;
      const fator = dia === "1" ? e.fator1 : e.fator2;
      return { produto: p.nome, pedido, entregue, fator };
    })
    .filter((x) => x.pedido > 0.004 && x.fator < 0.9999);

  return (
    <>
      <div className="botoes nao-imprimir" style={{ justifyContent: "space-between" }}>
        <div>
          <h2 style={{ margin: 0 }}>Galpão: {nomeDia.toLowerCase()}</h2>
          <p className="discreto" style={{ margin: "4px 0 0" }}>
            Igual ao romaneio do produtor. Digite só o que foi diferente; o que ficar em branco conta como <strong>veio o pedido</strong>. Caixa grande desconta{" "}
            {cad.pesoCaixa.grande} kg e pequena {cad.pesoCaixa.pequena} kg.
          </p>
        </div>
        <Link className="botao claro" href={`/coop/semana/${data}/imprimir/produtores?dia=${dia}`}>
          🖨 Romaneios dos produtores (papel)
        </Link>
      </div>
      {faltas.length > 0 ? (
        <div className="erro">
          <strong>Vai faltar nas {rotasDoDia}:</strong>{" "}
          {faltas.map((f) => `${f.produto} (chegou ${kg(f.entregue)} de ${kg(f.pedido)} kg, cada escola recebe ${Math.round(f.fator * 100)}%)`).join("; ")}. O mapa de
          montagem já divide o que tem.
        </div>
      ) : (
        <p className="ok">Com o que foi lançado até agora, dá para atender todas as escolas das {rotasDoDia}.</p>
      )}
      <Galpao data={data} dia={dia} cartoes={cartoes} caixa={cad.pesoCaixa} />
    </>
  );
}
