import Link from "next/link";
import { kg } from "@/lib/coop/numeros";
import type { DiaRota } from "@/lib/coop/tipos";
import { carregarSemana } from "../../../dados";
import { Excedente } from "../Excedente";
import { Reentregas } from "../Reentregas";
import { AjusteMapa } from "./AjusteMapa";

export const metadata = { title: "Mapa de montagem" };

export default async function Mapa({ params, searchParams }: PageProps<"/coop/semana/[data]/mapa">) {
  const { data } = await params;
  const q = await searchParams;
  const dia: DiaRota = q.dia === "TER" ? "TER" : "SEG";
  const { cad, sem, r } = await carregarSemana(data);
  const base = `/coop/semana/${data}`;
  const rotas = sem.rotas.filter((x) => x.dia === dia);
  const nomeDia = (d: DiaRota) => (sem.rotas.find((x) => x.dia === d)?.titulo.split(" — ")[0] ?? (d === "SEG" ? "1º dia" : "2º dia")).toLowerCase();
  const galpao = dia === "SEG" ? sem.diasGalpao[0] : sem.diasGalpao[1];
  const unidade = (p: string) => cad.produtos.find((x) => x.nome === p)?.unidade ?? "kg";
  // Colunas na ordem do mapa da planilha (v100: chuchu primeiro, espinafre por último).
  const produtosMapa = r.ordemMapa.map((nome) => cad.produtos.find((p) => p.nome === nome)!).filter(Boolean);

  return (
    <>
      <div className="botoes" style={{ justifyContent: "space-between" }}>
        <nav className="abas" style={{ margin: 0 }}>
          {(["SEG", "TER"] as const).map((d) => (
            <Link key={d} href={`${base}/mapa?dia=${d}`} className={d === dia ? "ativa" : undefined}>
              Escolas de {nomeDia(d)}
            </Link>
          ))}
        </nav>
        <div className="botoes">
          <Link className="botao" href={`${base}/imprimir/dia?dia=${dia}`}>
            🖨 Tudo de {nomeDia(dia)}: mapa + excedente + romaneios
          </Link>
          <Link className="botao claro" href={`${base}/imprimir/mapa?dia=${dia}`}>
            só o mapa
          </Link>
          <Link className="botao claro" href={`${base}/imprimir/escolas?dia=${dia}`}>
            só os romaneios
          </Link>
        </div>
      </div>
      <p className="discreto">
        Monta com o que os produtores entregaram no {galpao.toLowerCase()}. Quando falta, cada escola recebe a mesma parte, na ordem da rota (igual à planilha).
      </p>
      <AjusteMapa
        data={data}
        linhas={r.ordemMapa
          .filter((p) => r.entregaProduto[p].pedidoSeg + r.entregaProduto[p].pedidoTer > 0)
          .map((p) => {
            const e = r.entregaProduto[p];
            const aj = sem.ajusteEntrega?.[p] ?? {};
            return {
              produto: p,
              doisDias: e.planejado2 > 0.004,
              automatico1: e.fator1 * 100,
              automatico2: e.fator2 * 100,
              somarDias: Boolean(aj.somarDias),
              fator1: aj.fator1 === undefined ? null : Math.round(aj.fator1 * 1000) / 10,
              fator2: aj.fator2 === undefined ? null : Math.round(aj.fator2 * 1000) / 10,
            };
          })}
      />
      {rotas.map((rota) => {
        const produtos = produtosMapa.filter((p) => rota.paradas.some((pa) => (r.enviado[pa.codigo]?.[p.nome] ?? 0) > 0.0001 || (sem.pedidoEscolas[pa.codigo]?.[p.nome] ?? 0) > 0));
        const totais = produtos.map((p) => rota.paradas.reduce((s, pa) => s + (r.enviado[pa.codigo]?.[p.nome] ?? 0), 0));
        return (
          <section key={rota.id}>
            <div className="rota-titulo botoes" style={{ justifyContent: "space-between" }}>
              <span>{rota.titulo}</span>
              <span className="botoes">
                <Link className="botao pequeno claro" href={`${base}/imprimir/mapa?dia=${dia}&rota=${encodeURIComponent(rota.id)}`}>
                  🖨 mapa
                </Link>
                <Link className="botao pequeno claro" href={`${base}/imprimir/escolas?dia=${dia}&rota=${encodeURIComponent(rota.id)}`}>
                  🖨 romaneios
                </Link>
              </span>
            </div>
            <div className="rota-corpo rolar">
              {rota.saida && <p className="discreto" style={{ margin: "6px 10px" }}>{rota.saida}</p>}
              <table className="tabela mapa-tab">
                <thead>
                  <tr>
                    <th>Nº</th>
                    <th>Cód.</th>
                    <th>Escola</th>
                    {produtos.map((p) => (
                      <th key={p.nome} className="n">
                        {p.nome}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rota.paradas.map((pa) => (
                    <tr key={pa.codigo}>
                      <td>
                        {pa.par}
                        {pa.sub}
                      </td>
                      <td>{pa.codigo}</td>
                      <td>
                        {pa.nomeMapa}
                        <div className="discreto">{pa.bairro}</div>
                      </td>
                      {produtos.map((p) => {
                        const env = r.enviado[pa.codigo]?.[p.nome] ?? 0;
                        const ped = sem.pedidoEscolas[pa.codigo]?.[p.nome] ?? 0;
                        const curto = ped - env > 0.005;
                        return (
                          <td key={p.nome} className="n" style={curto ? { color: "var(--c-vermelho)" } : undefined} title={curto ? `Pedido ${kg(ped)}` : undefined}>
                            {env > 0.0001 ? kg(env) : ""}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3}>Total da rota</td>
                    {totais.map((t, i) => (
                      <td key={produtos[i].nome} className="n">
                        {kg(t)}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        );
      })}
      <Reentregas cad={cad} sem={sem} r={r} dia={dia} />
      <Excedente dia={dia} ex={r.excedente[dia]} rotas={sem.rotas} unidade={unidade} comLegumes={cad.excedenteLegumes} />
    </>
  );
}
