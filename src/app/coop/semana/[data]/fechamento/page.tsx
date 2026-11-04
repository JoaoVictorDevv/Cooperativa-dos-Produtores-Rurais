import Link from "next/link";
import { kg, reais } from "@/lib/coop/numeros";
import { carregarSemana } from "../../../dados";
import { Fechamento } from "./Fechamento";

export const metadata = { title: "Fechamento" };

export default async function PaginaFechamento({ params }: PageProps<"/coop/semana/[data]/fechamento">) {
  const { data } = await params;
  const { cad, sem, r } = await carregarSemana(data);
  const base = `/coop/semana/${data}`;
  const produtos = r.resumo.produtos
    .filter((p) => p.pedido > 0)
    .map((p) => ({
      produto: p.produto,
      pedido: p.pedido,
      // Soma do que cada escola aceitou (coluna U das fichas), sem a conferência.
      aceitoEscolas: Math.min(p.pedido, Object.values(r.fichas).reduce((s, f) => s + (f[p.produto]?.cobrado ?? 0), 0)), conferido: sem.conferidoPrefeitura[p.produto] ?? null, preco: cad.produtos.find((x) => x.nome === p.produto)?.preco ?? 0 }));
  const b = r.balanco;
  return (
    <>
      <Fechamento data={data} produtos={produtos} custos={sem.custos} conferidos={sem.romaneiosConferidos} />
      <h2>Resultado</h2>
      <div className="grade">
        <div className="numero">
          <small>Cobrar da Prefeitura</small>
          <strong>{reais(b.cobrado)}</strong>
        </div>
        <div className="numero">
          <small>Pagar aos produtores</small>
          <strong>{reais(b.pago)}</strong>
        </div>
        <div className="numero">
          <small>Custos</small>
          <strong>{reais(b.custos)}</strong>
        </div>
        <div className={`numero${Math.abs(b.perdas ?? 0) > 0.004 ? " ruim" : ""}`}>
          <small>Perdas (balanço)</small>
          <strong>{b.perdas === null ? "aguardando escolas" : reais(Math.abs(b.perdas))}</strong>
        </div>
        <div className={`numero ${b.saldo >= 0 ? "bom" : "ruim"}`}>
          <small>Saldo</small>
          <strong>{reais(b.saldo)}</strong>
        </div>
      </div>
      <div className="botoes" style={{ margin: "14px 0" }}>
        <Link className="botao claro" href={`${base}/imprimir/paulo`}>
          🖨 Resumo de 1 página (Paulo)
        </Link>
        <Link className="botao claro" href={`${base}/imprimir/extratos`}>
          🖨 Extratos de todos os produtores
        </Link>
      </div>
      <h2>Pagamento dos produtores</h2>
      <div className="card rolar">
        <table className="tabela">
          <thead>
            <tr>
              <th>Produtor</th>
              <th className="n">Pedido (kg)</th>
              <th className="n">Entregou (kg)</th>
              <th className="n">Pago (kg)</th>
              <th className="n">A pagar</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {cad.produtores
              .filter((p) => r.pagarProdutor[p.id] > 0 || Object.values(r.produtores[p.id]).some((x) => x.pedido > 0))
              .map((p) => {
                const x = Object.values(r.produtores[p.id]);
                return (
                  <tr key={p.id}>
                    <td>{p.nome}</td>
                    <td className="n">{kg(x.reduce((s, i) => s + i.pedido, 0))}</td>
                    <td className="n">{kg(x.reduce((s, i) => s + i.entregue, 0))}</td>
                    <td className="n">{kg(x.reduce((s, i) => s + i.pagoKg, 0))}</td>
                    <td className="n">
                      <strong>{reais(r.pagarProdutor[p.id])}</strong>
                    </td>
                    <td className="direita">
                      <Link className="botao pequeno claro" href={`${base}/imprimir/extratos?produtor=${encodeURIComponent(p.id)}`}>
                        extrato
                      </Link>
                    </td>
                  </tr>
                );
              })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4}>Total</td>
              <td className="n">{reais(b.pago)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}
