import Link from "next/link";
import { lerPrevisao, lerSemana, listarSemanas } from "@/lib/coop/armazem";
import { calcularSemana } from "@/lib/coop/motor";
import { kg, reais } from "@/lib/coop/numeros";
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
    const prev = await lerPrevisao(d);
    linhas.push({ s, r, previsto: prev ? prev.itens.reduce((t, i) => t + i.kg, 0) : null });
  }
  const meses = new Map<string, { cobrar: number; pagar: number; custos: number; perdas: number; saldo: number; kg: number; semanas: number }>();
  for (const { s, r } of linhas) {
    const k = s.data.slice(0, 7);
    const m = meses.get(k) ?? { cobrar: 0, pagar: 0, custos: 0, perdas: 0, saldo: 0, kg: 0, semanas: 0 };
    m.cobrar += r.balanco.cobrado;
    m.pagar += r.balanco.pago;
    m.custos += r.balanco.custos;
    m.perdas += Math.abs(r.balanco.perdas ?? 0);
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
  return (
    <>
      <h1>Relatórios</h1>
      <p className="sub">Somando todas as semanas que estão no app.</p>
      {!linhas.length && <p className="aviso">Ainda não há semanas.</p>}
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
                <td className="n">{r.balanco.perdas === null ? "aguardando" : reais(Math.abs(r.balanco.perdas))}</td>
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
                    <td>{p.nome}</td>
                    <td className="n">{reais(v)}</td>
                    <td className="n">{kg((v / LIMITE) * 100, 1)}%</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </>
  );
}
