import Link from "next/link";
import { lerSemana, listarSemanas, previsaoDaSemana } from "@/lib/coop/armazem";
import { calcularSemana } from "@/lib/coop/motor";
import { kg, reais } from "@/lib/coop/numeros";
import { NOME_CAUSA, perdasDaSemana, type ItemPerda } from "@/lib/coop/perdas";
import { carregarCadastro } from "../dados";

export const metadata = { title: "Relatórios" };

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const LIMITE = 40000;

export default async function Relatorios() {
  const cad = await carregarCadastro();
  if (!cad) return <p className="aviso">Primeiro traga o MODELO no <Link href="/coop/cadastro">Cadastro</Link>.</p>;
  const datas = (await listarSemanas()).slice().reverse();
  const linhas = [];
  for (const d of datas) {
    const s = await lerSemana(d);
    if (!s) continue;
    const r = calcularSemana(cad, s);
    const prev = await previsaoDaSemana(d);
    linhas.push({ s, r, previsto: prev ? prev.itens.reduce((t, i) => t + i.kg, 0) : null });
  }
  const meses = new Map<string, { cobrar: number; pagar: number; custos: number; perdas: number; saldo: number; kg: number; semanas: number; divida: number }>();
  const dividaTotal = linhas.reduce((s, { r }) => s + r.balanco.administrativoFalta, 0);
  for (const { s, r } of linhas) {
    const k = s.data.slice(0, 7);
    const m = meses.get(k) ?? { cobrar: 0, pagar: 0, custos: 0, perdas: 0, saldo: 0, kg: 0, semanas: 0, divida: 0 };
    m.divida += r.balanco.administrativoFalta;
    m.cobrar += r.balanco.cobrado;
    m.pagar += r.balanco.pago;
    m.custos += r.balanco.custos;
    m.perdas += perdasDaSemana(cad, s, r).total;
    m.saldo += r.balanco.saldo;
    m.kg += r.resumo.pedidoTotal;
    m.semanas += 1;
    meses.set(k, m);
  }
  const ano = new Map<string, number>();
  for (const { s, r } of linhas) {
    if (s.data.slice(0, 4) !== (datas.at(-1) ?? "").slice(0, 4)) continue;
    for (const [p, v] of Object.entries(r.pagarProdutor)) ano.set(p, (ano.get(p) ?? 0) + v);
  }
  // Perdas por produto, somando as semanas (escola por escola).
  const porProduto = new Map<string, { kg: number; valor: number; semanas: Set<string>; motivos: Map<string, number> }>();
  for (const { s, r } of linhas) {
    const itens: ItemPerda[] = perdasDaSemana(cad, s, r).linhas.flatMap((l) => l.itens);
    for (const i of itens) {
      const x = porProduto.get(i.produto) ?? { kg: 0, valor: 0, semanas: new Set<string>(), motivos: new Map<string, number>() };
      x.kg += i.kg;
      x.valor += i.valor;
      x.semanas.add(s.data);
      const motivo = i.causa === "semReceber" ? NOME_CAUSA.semReceber.toLowerCase() : i.detalhe ? i.detalhe.toLowerCase() : NOME_CAUSA[i.causa].toLowerCase();
      x.motivos.set(motivo, (x.motivos.get(motivo) ?? 0) + i.valor);
      porProduto.set(i.produto, x);
    }
  }
  const perdasProduto = [...porProduto.entries()].sort((a, b) => b[1].valor - a[1].valor);
  const totalPerdasProduto = perdasProduto.reduce((t, [, x]) => t + x.valor, 0);
  return (
    <>
      <h1>Relatórios</h1>
      <p className="sub">Somando todas as semanas que estão no app.</p>
      {!linhas.length && <p className="aviso">Ainda não há semanas.</p>}
      {dividaTotal > 0 && (
        <p className="aviso">
          <strong>Administrativo que ficou faltando:</strong> {reais(dividaTotal)} no total ({linhas.filter(({ r }) => r.balanco.administrativoFalta > 0).map(({ s, r }) => `${s.referencia.slice(0, 5)}: ${reais(r.balanco.administrativoFalta)}`).join(" · ")}). Já está dentro dos custos; é o que a cooperativa deve.
        </p>
      )}
      <h2>Por mês</h2>
      <div className="card rolar">
        <table className="tabela">
          <thead>
            <tr>
              <th>Mês</th>
              <th className="n">Semanas</th>
              <th className="n">Pedido (kg)</th>
              <th className="n">Cobrar</th>
              <th className="n">Pagar produtores</th>
              <th className="n">Custos</th>
              <th className="n">Perdas</th>
              <th className="n">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {[...meses.entries()].map(([k, m]) => (
              <tr key={k}>
                <td>
                  {MESES[Number(k.slice(5)) - 1]}/{k.slice(0, 4)}
                </td>
                <td className="n">{m.semanas}</td>
                <td className="n">{kg(m.kg)}</td>
                <td className="n">{reais(m.cobrar)}</td>
                <td className="n">{reais(m.pagar)}</td>
                <td className="n">{reais(m.custos)}</td>
                <td className="n">{reais(m.perdas)}</td>
                <td className="n">
                  <strong>{reais(m.saldo)}</strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2>Por semana: previsão × pedido × galpão</h2>
      <div className="card rolar">
        <table className="tabela">
          <thead>
            <tr>
              <th>Semana</th>
              <th className="n">Previsão (kg)</th>
              <th className="n">Pedido (kg)</th>
              <th className="n">Entregue no galpão</th>
              <th className="n">Perdas</th>
              <th className="n">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map(({ s, r, previsto }) => (
              <tr key={s.data}>
                <td>
                  <Link href={`/coop/semana/${s.data}`}>{s.referencia}</Link>
                </td>
                <td className="n">{previsto === null ? "—" : kg(previsto)}</td>
                <td className="n">{kg(r.resumo.pedidoTotal)}</td>
                <td className="n">{kg(r.resumo.totais.entregueGalpao)}</td>
                <td className="n">
                  <Link href={`/coop/semana/${s.data}/perdas`}>{reais(perdasDaSemana(cad, s, r).total)}</Link>
                </td>
                <td className="n">{reais(r.balanco.saldo)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2>Vendido por produtor no ano</h2>
      <p className="discreto">Só informação: a referência de R$ 40.000,00 por produtor não trava, não corta e não reduz nada.</p>
      <div className="card rolar">
        <table className="tabela">
          <thead>
            <tr>
              <th>Produtor</th>
              <th className="n">Vendido</th>
              <th className="n">% de R$ 40 mil</th>
            </tr>
          </thead>
          <tbody>
            {cad.produtores
              .filter((p) => (ano.get(p.id) ?? 0) > 0)
              .sort((a, b) => (ano.get(b.id) ?? 0) - (ano.get(a.id) ?? 0))
              .map((p) => {
                const v = ano.get(p.id) ?? 0;
                return (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/coop/produtor/${encodeURIComponent(p.id)}`}>{p.nome}</Link>
                    </td>
                    <td className="n">{reais(v)}</td>
                    <td className="n">{kg((v / LIMITE) * 100, 1)}%</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
      {perdasProduto.length > 0 && (
        <details className="adicional">
          <summary>
            Adicional: perdas por produto
            <small>
              mais perdido: {perdasProduto[0][0].toLowerCase()} ({reais(perdasProduto[0][1].valor)} em {perdasProduto[0][1].semanas.size} semana{perdasProduto[0][1].semanas.size > 1 ? "s" : ""})
            </small>
          </summary>
          <div className="dentro">
            <p className="discreto">Soma de todas as semanas, escola por escola (sem o ajuste da conferência da Prefeitura). Mostra onde está o problema.</p>
            <div className="rolar">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th className="n">Perdido (kg)</th>
                    <th className="n">Valor</th>
                    <th className="n">% das perdas</th>
                    <th className="n">Semanas</th>
                    <th>Principal motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {perdasProduto.map(([produto, x]) => {
                    const [motivo, valorMotivo] = [...x.motivos.entries()].sort((a, b) => b[1] - a[1])[0];
                    return (
                      <tr key={produto}>
                        <td>{produto}</td>
                        <td className="n">{kg(x.kg)}</td>
                        <td className="n">{reais(x.valor)}</td>
                        <td className="n">{kg((x.valor / totalPerdasProduto) * 100, 0)}%</td>
                        <td className="n">{x.semanas.size}</td>
                        <td>
                          {motivo} <span className="discreto">({kg((valorMotivo / x.valor) * 100, 0)}%)</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td>Total</td>
                    <td className="n">{kg(perdasProduto.reduce((t, [, x]) => t + x.kg, 0))}</td>
                    <td className="n">{reais(totalPerdasProduto)}</td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </details>
      )}
    </>
  );
}
