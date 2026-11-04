import Link from "next/link";
import { kg, reais } from "@/lib/coop/numeros";
import { listinha } from "@/lib/coop/semana";
import { carregarSemana } from "../../dados";

const LINKS: Record<string, string> = {
  pedido: "",
  mensagens: "/pedido",
  dia1: "/galpao/1",
  dia2: "/galpao/2",
  retornos: "/retornos",
  prefeitura: "/fechamento",
  custos: "/fechamento",
};

export default async function ResumoSemana({ params }: PageProps<"/coop/semana/[data]">) {
  const { data } = await params;
  const { cad, sem, r } = await carregarSemana(data);
  const itens = listinha(cad, sem, r);
  const base = `/coop/semana/${data}`;
  const faltas = Object.entries(r.faltaNaDivisao).filter(([, v]) => v >= 0.005);
  return (
    <>
      <h2 style={{ marginTop: 0 }}>O que falta</h2>
      <div className="passos">
        {itens.map((i, k) => (
          <Link key={i.chave} href={`${base}${LINKS[i.chave] ?? ""}`} className={`passo${i.feito ? " feito" : ""}`}>
            <div className="bola">{i.feito ? "✓" : k + 1}</div>
            <div>
              <strong>{i.texto}</strong>
              {i.detalhe && <span>{i.detalhe}</span>}
            </div>
          </Link>
        ))}
      </div>
      {faltas.length > 0 && (
        <p className="aviso">
          Os produtores não têm tudo no Mapa de Produção:{" "}
          {faltas.map(([p, v]) => `${p} falta ${kg(v)} kg`).join(", ")}. Veja em <Link href={`${base}/pedido`}>Pedido</Link>.
        </p>
      )}
      <h2>Números da semana</h2>
      <div className="grade">
        <div className="numero">
          <small>Pedido (já com os cortes)</small>
          <strong>{kg(r.resumo.pedidoTotal)} kg</strong>
        </div>
        <div className="numero">
          <small>Cobrar da Prefeitura</small>
          <strong>{reais(r.resumo.cobrar)}</strong>
        </div>
        <div className="numero">
          <small>Pagar aos produtores</small>
          <strong>{reais(r.resumo.pagar)}</strong>
        </div>
        <div className="numero">
          <small>Taxa de logística (R$ {kg(cad.taxaLogistica)}/kg)</small>
          <strong>{reais(r.resumo.taxaLogistica)}</strong>
        </div>
        <div className={`numero${Math.abs(r.balanco.perdas ?? 0) > 0.004 ? " ruim" : ""}`}>
          <small>Perdas (balanço)</small>
          <strong>{r.balanco.perdas === null ? "aguardando escolas" : reais(Math.abs(r.balanco.perdas))}</strong>
        </div>
        <div className={`numero ${r.balanco.saldo >= 0 ? "bom" : "ruim"}`}>
          <small>Saldo (balanço)</small>
          <strong>{reais(r.balanco.saldo)}</strong>
        </div>
      </div>
      <h2>Por produto</h2>
      <div className="card rolar">
        <table className="tabela">
          <thead>
            <tr>
              <th>Produto</th>
              <th className="n">Pedido</th>
              <th className="n">Entregue no galpão</th>
              <th className="n">Pago (kg)</th>
              <th className="n">Cobrado (kg)</th>
              <th className="n">Cobrar</th>
              <th className="n">Pagar</th>
            </tr>
          </thead>
          <tbody>
            {r.resumo.produtos
              .filter((p) => p.pedido > 0 || p.entregueGalpao > 0)
              .map((p) => (
                <tr key={p.produto}>
                  <td>{p.produto}</td>
                  <td className="n">{kg(p.pedido)}</td>
                  <td className="n">{kg(p.entregueGalpao)}</td>
                  <td className="n">{kg(p.pagoKg)}</td>
                  <td className="n">{kg(p.cobradoKg)}</td>
                  <td className="n">{reais(p.valorCobrado)}</td>
                  <td className="n">{reais(p.valorPago)}</td>
                </tr>
              ))}
          </tbody>
          <tfoot>
            <tr>
              <td>Total</td>
              <td className="n">{kg(r.resumo.totais.pedido)}</td>
              <td className="n">{kg(r.resumo.totais.entregueGalpao)}</td>
              <td className="n">{kg(r.resumo.totais.pagoKg)}</td>
              <td className="n">{kg(r.resumo.totais.cobradoKg)}</td>
              <td className="n">{reais(r.resumo.totais.valorCobrado)}</td>
              <td className="n">{reais(r.resumo.totais.valorPago)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}
