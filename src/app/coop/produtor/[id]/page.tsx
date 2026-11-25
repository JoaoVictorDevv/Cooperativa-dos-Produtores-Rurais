import Link from "next/link";
import { notFound } from "next/navigation";
import { lerSemana, listarSemanas, previsaoDaSemana } from "@/lib/coop/armazem";
import { linkWhatsApp, telefoneWhatsApp } from "@/lib/coop/mensagens";
import { calcularSemana } from "@/lib/coop/motor";
import { kg, reais } from "@/lib/coop/numeros";
import { carregarCadastro } from "../../dados";
import { LIMITE_ANO, limitePorProdutor } from "@/lib/coop/limite";

export const metadata = { title: "Ficha do produtor" };


export default async function FichaProdutor({ params }: PageProps<"/coop/produtor/[id]">) {
  const { id } = await params;
  const cad = await carregarCadastro();
  if (!cad) notFound();
  const p = cad.produtores.find((x) => x.id === decodeURIComponent(id));
  if (!p) notFound();

  const datas = (await listarSemanas()).slice().reverse(); // da mais velha para a mais nova
  const anoAtual = (datas.at(-1) ?? "").slice(0, 4);
  const semanas = [];
  const porProduto = new Map<string, { pedido: number; entregue: number; pago: number; valor: number }>();
  for (const d of datas) {
    const s = await lerSemana(d);
    if (!s) continue;
    const r = calcularSemana(cad, s);
    const itens = Object.entries(r.produtores[p.id] ?? {});
    const pedido = itens.reduce((t, [, x]) => t + x.pedido, 0);
    const entregue = itens.reduce((t, [, x]) => t + x.entregue, 0);
    if (pedido < 0.005 && entregue < 0.005) continue;
    const prev = await previsaoDaSemana(d);
    const prometido = prev ? prev.itens.filter((i) => i.produtor === p.id).reduce((t, i) => t + i.kg, 0) : null;
    const lancou = r.resumo.entregasLancadasKg > 0;
    for (const [produto, x] of itens) {
      if (x.pedido < 0.005 && x.entregue < 0.005) continue;
      const a = porProduto.get(produto) ?? { pedido: 0, entregue: 0, pago: 0, valor: 0 };
      a.pedido += x.pedido;
      a.entregue += x.entregue;
      a.pago += x.pagoKg;
      a.valor += x.valor;
      porProduto.set(produto, a);
    }
    semanas.push({
      s,
      lancou,
      pedido,
      entregue,
      pago: itens.reduce((t, [, x]) => t + x.pagoKg, 0),
      desconto: r.descontoProdutor[p.id] ?? 0,
      receber: r.pagarProdutor[p.id] ?? 0,
      prometido,
      produtos: itens.filter(([, x]) => x.pedido > 0.004).map(([n]) => n),
    });
  }
  const comEntrega = semanas.filter((x) => x.lancou);
  // Limite de R$ 40 mil: pelo valor de venda (pago × preço da Prefeitura) + pedido das semanas sem entrega.
  const limite = (await limitePorProdutor(cad)).linhas.find((x) => x.id === p.id);
  const vendidoAno = limite?.total ?? 0;
  const totalDesconto = semanas.reduce((t, x) => t + x.desconto, 0);
  const pedidoTotal = comEntrega.reduce((t, x) => t + x.pedido, 0);
  const pagoTotal = comEntrega.reduce((t, x) => t + x.pago, 0);
  const cumpriu = pedidoTotal > 0 ? (pagoTotal / pedidoTotal) * 100 : 0;
  const zap = telefoneWhatsApp(p.telefone) ? linkWhatsApp(p.telefone, `Olá, ${p.curto}!`) : null;
  const comPrevisao = comEntrega.filter((x) => x.prometido !== null && x.prometido > 0);

  return (
    <>
      <Link className="voltar" href="/coop/relatorios">
        ← Relatórios
      </Link>
      <h1>{p.nome}</h1>
      <p className="sub">
        Chamado de {p.curto} · Telefone: {p.telefone ?? "sem número no cadastro"}
        {zap && (
          <>
            {" "}
            ·{" "}
            <a href={zap} target="_blank" rel="noreferrer">
              abrir WhatsApp
            </a>
          </>
        )}
      </p>

      <div className="grade">
        <div className="numero">
          <small>Vendido no ano {anoAtual} (valor de venda)</small>
          <strong>{reais(vendidoAno)}</strong>
          <span className="discreto">
            {kg((vendidoAno / LIMITE_ANO) * 100, 1)}% de R$ 40 mil
            {limite && limite.previsto > 0.004 ? ` · inclui ${reais(limite.previsto)} de pedido ainda sem entrega` : ""}
          </span>
        </div>
        <div className="numero">
          <small>Semanas com entrega</small>
          <strong>{comEntrega.length}</strong>
        </div>
        <div className={`numero ${cumpriu >= 95 ? "bom" : cumpriu < 80 ? "ruim" : ""}`}>
          <small>Do pedido, entregou e foi aceito</small>
          <strong>{comEntrega.length ? `${kg(cumpriu, 0)}%` : "—"}</strong>
          <span className="discreto">
            {kg(pagoTotal, 0)} de {kg(pedidoTotal, 0)} kg
          </span>
        </div>
        <div className={`numero${totalDesconto > 0 ? " ruim" : ""}`}>
          <small>Descontos (ex.: folha estragada)</small>
          <strong>{reais(totalDesconto)}</strong>
        </div>
      </div>

      <h2>Semana a semana</h2>
      {!semanas.length && <p className="aviso">Este produtor ainda não teve pedido nas semanas do app.</p>}
      {semanas.length > 0 && (
        <div className="card rolar">
          <table className="tabela">
            <thead>
              <tr>
                <th>Semana</th>
                <th>Produtos</th>
                <th className="n">Pedido (kg)</th>
                <th className="n">Trouxe (kg)</th>
                <th className="n">Pago (kg)</th>
                <th className="n">Desconto</th>
                <th className="n">A receber</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {semanas
                .slice()
                .reverse()
                .map((x) => (
                  <tr key={x.s.data}>
                    <td>
                      <Link href={`/coop/semana/${x.s.data}`}>{x.s.referencia}</Link>
                    </td>
                    <td className="discreto">{x.produtos.join(", ")}</td>
                    <td className="n">{kg(x.pedido)}</td>
                    <td className="n">{x.lancou ? kg(x.entregue) : "—"}</td>
                    <td className="n">{x.lancou ? kg(x.pago) : "—"}</td>
                    <td className="n">{x.desconto > 0 ? <span className="etiqueta vermelha">− {reais(x.desconto)}</span> : "—"}</td>
                    <td className="n">
                      <strong>{x.lancou ? reais(x.receber) : "—"}</strong>
                    </td>
                    <td className="direita">
                      {x.lancou && (
                        <Link className="botao pequeno claro" href={`/coop/semana/${x.s.data}/imprimir/extratos?produtor=${encodeURIComponent(p.id)}`}>
                          🖨 Demonstrativo
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {porProduto.size > 0 && (
        <details className="adicional">
          <summary>
            Adicional: por produto<small>tudo somado</small>
          </summary>
          <div className="dentro rolar">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th className="n">Pedido (kg)</th>
                  <th className="n">Trouxe (kg)</th>
                  <th className="n">Pago (kg)</th>
                  <th className="n">Valor</th>
                </tr>
              </thead>
              <tbody>
                {[...porProduto.entries()]
                  .sort((a, b) => b[1].valor - a[1].valor)
                  .map(([produto, a]) => (
                    <tr key={produto}>
                      <td>{produto}</td>
                      <td className="n">{kg(a.pedido)}</td>
                      <td className="n">{kg(a.entregue)}</td>
                      <td className="n">{kg(a.pago)}</td>
                      <td className="n">{reais(a.valor)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {comPrevisao.length > 0 && (
        <details className="adicional">
          <summary>
            Adicional: previsão × entregue<small>o que prometeu e o que trouxe</small>
          </summary>
          <div className="dentro rolar">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Semana</th>
                  <th className="n">Prometeu (kg)</th>
                  <th className="n">Trouxe (kg)</th>
                  <th className="n">Do prometido</th>
                </tr>
              </thead>
              <tbody>
                {comPrevisao.map((x) => (
                  <tr key={x.s.data}>
                    <td>{x.s.referencia}</td>
                    <td className="n">{kg(x.prometido!)}</td>
                    <td className="n">{kg(x.entregue)}</td>
                    <td className="n">{kg((x.entregue / x.prometido!) * 100, 0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </>
  );
}
