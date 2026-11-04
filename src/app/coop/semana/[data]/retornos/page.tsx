import { carregarSemana } from "../../../dados";
import { Retornos, type RotaRetorno } from "./Retornos";

export const metadata = { title: "Retornos das escolas" };

export default async function PaginaRetornos({ params }: PageProps<"/coop/semana/[data]/retornos">) {
  const { data } = await params;
  const { cad, sem, r } = await carregarSemana(data);
  const nomes = new Map(cad.escolas.map((e) => [e.codigo, e.nome]));
  const rotas: RotaRetorno[] = sem.rotas.map((ro) => ({
    id: ro.id,
    titulo: ro.titulo,
    escolas: ro.paradas
      .map((pa) => ({
        codigo: pa.codigo,
        nome: nomes.get(pa.codigo) ?? pa.nomeMapa,
        nomeMapa: pa.nomeMapa,
        parada: `${pa.par}${pa.sub}`,
        itens: cad.produtos
          .filter((p) => (sem.pedidoEscolas[pa.codigo]?.[p.nome] ?? 0) > 0)
          .map((p) => {
            const f = r.fichas[pa.codigo]?.[p.nome];
            return {
              produto: p.nome,
              pedido: sem.pedidoEscolas[pa.codigo][p.nome],
              enviado: r.enviado[pa.codigo]?.[p.nome] ?? 0,
              retorno: sem.retornos[pa.codigo]?.[p.nome] ?? null,
              aceito: f?.totalAceito ?? 0,
              falta: f?.falta ?? 0,
            };
          }),
      }))
      .filter((e) => e.itens.length > 0),
  }));
  return (
    <Retornos
      data={data}
      rotas={rotas}
      produtos={cad.produtos.map((p) => p.nome)}
      motivos={cad.motivos}
      conferidos={sem.romaneiosConferidos}
    />
  );
}
