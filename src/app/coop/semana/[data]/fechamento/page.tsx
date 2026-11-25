import Link from "next/link";
import { kg, reais } from "@/lib/coop/numeros";
import { linkWhatsApp, textoDemonstrativo } from "@/lib/coop/mensagens";
import { custoDaEscala, diariasDaEscala, escalaDe } from "@/lib/coop/escala";
import { carregarSemana } from "../../../dados";
import { perdasDaSemana } from "@/lib/coop/perdas";
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
      <Fechamento
        data={data}
        produtos={produtos}
        custos={sem.custos}
        conferidos={sem.romaneiosConferidos}
        observacao={sem.observacao ?? ""}
        escala={{ diarias: diariasDaEscala(escalaDe(cad)), diaria: escalaDe(cad).diaria, total: custoDaEscala(escalaDe(cad)) }}
        produtores={cad.produtores.filter((p) => r.pagarProdutor[p.id] > 0 || (sem.descontos?.[p.id] ?? 0) > 0).map((p) => ({ id: p.id, nome: p.nome, aPagar: r.pagarProdutor[p.id] + (sem.descontos?.[p.id] ?? 0), desconto: sem.descontos?.[p.id] ?? 0 }))}
      />
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
        <Link href={`${base}/perdas`} className={`numero${perdasDaSemana(cad, sem, r).total > 0.004 ? " ruim" : ""}`}>
          <small>Perdas (Prefeitura não pagou) ›</small>
          <strong>{reais(perdasDaSemana(cad, sem, r).total)}</strong>
        </Link>
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
          🖨 Demonstrativos de todos os produtores
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
              <th className="n">Desconto</th>
              <th className="n">A pagar</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {cad.produtores
              .filter((p) => r.pagarProdutor[p.id] > 0 || Object.values(r.produtores[p.id]).some((x) => x.pedido > 0))
              .map((p) => {
                const x = Object.values(r.produtores[p.id]);
                const texto = textoDemonstrativo(cad, sem, r, p);
                const zap = texto ? linkWhatsApp(p.telefone, texto) : null;
                return (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/coop/produtor/${encodeURIComponent(p.id)}`}>{p.nome}</Link>
                    </td>
                    <td className="n">{kg(x.reduce((s, i) => s + i.pedido, 0))}</td>
                    <td className="n">{kg(x.reduce((s, i) => s + i.entregue, 0))}</td>
                    <td className="n">{kg(x.reduce((s, i) => s + i.pagoKg, 0))}</td>
                    <td className="n">{r.descontoProdutor[p.id] > 0 ? <span className="etiqueta vermelha">− {reais(r.descontoProdutor[p.id])}</span> : "—"}</td>
                    <td className="n">
                      <strong>{reais(r.pagarProdutor[p.id])}</strong>
                    </td>
                    <td className="direita" style={{ whiteSpace: "nowrap" }}>
                      <Link className="botao pequeno claro" href={`${base}/imprimir/extratos?produtor=${encodeURIComponent(p.id)}`}>
                        🖨 demonstrativo
                      </Link>{" "}
                      {zap ? (
                        <a className="botao pequeno" href={zap} target="_blank" rel="noreferrer" title="Abre a conversa com o texto pronto; é só enviar">
                          WhatsApp
                        </a>
                      ) : (
                        <span className="etiqueta vermelha" title="Cadastre o telefone no MODELO">sem número</span>
                      )}
                    </td>
                  </tr>
                );
              })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={5}>Total</td>
              <td className="n">{reais(b.pago)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}
