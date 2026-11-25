import Link from "next/link";
import { LIMITE_ANO, limitePorProdutor } from "@/lib/coop/limite";
import { kg, reais } from "@/lib/coop/numeros";
import { referenciaDeData } from "@/lib/coop/semana";
import { carregarCadastro } from "../dados";
import { BotaoImprimir } from "../ui";

export const metadata = { title: "Limite de R$ 40 mil" };

// Folha "Limite de R$ 40 mil por produtor" (como a do João). Só informação.
export default async function Limite() {
  const cad = await carregarCadastro();
  if (!cad) return <p className="aviso">Primeiro traga o MODELO no <Link href="/coop/cadastro">Cadastro</Link>.</p>;
  const l = await limitePorProdutor(cad);
  const perto = l.linhas.filter((x) => x.total / LIMITE_ANO >= 0.9);
  const pct = (v: number) => (v / LIMITE_ANO) * 100;
  return (
    <>
      <div className="botoes nao-imprimir" style={{ justifyContent: "space-between", marginBottom: 12 }}>
        <div>
          <h1>Limite de R$ 40 mil por produtor</h1>
          <p className="sub">Só informação: o app não trava nem corta pedido. Conta pelo valor de venda (o que a Prefeitura paga).</p>
        </div>
        <span className="botoes">
          <BotaoImprimir />
        </span>
      </div>
      <div className="folha limite" data-arquivo={`limite 40 mil ${l.ano}`}>
        <h3 className="limite-titulo">Limite de R$ 40 mil por produtor — {l.ano}</h3>
        <p className="linha-cab" style={{ color: "#555" }}>
          {cad.nomeCooperativa ?? "Cooperativa"} · PNAE · entregas de {l.primeira} até {l.ultima ? referenciaDeData(l.ultima).slice(0, 5) : "—"}
          {l.semanasPrevistas.length > 0 && ` (com o pedido de ${l.semanasPrevistas.join(", ")})`}
        </p>
        <table className="tabela-limite">
          <thead>
            <tr>
              <th>Produtor</th>
              <th className="n">Vendido em {l.ano}</th>
              <th className="n">Ainda pode vender</th>
              <th>Usado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {l.linhas.map((x) => {
              const p = pct(x.total);
              return (
                <tr key={x.id}>
                  <td>
                    <Link href={`/coop/produtor/${encodeURIComponent(x.id)}`} style={{ color: "inherit", textDecoration: "none" }}>
                      {x.curto}
                    </Link>
                  </td>
                  <td className="n">
                    {reais(x.total)}
                    {x.previsto > 0.004 && <small className="limite-prev">{reais(x.previsto)} do pedido ainda sem entrega</small>}
                  </td>
                  <td className="n">
                    <strong>{reais(Math.max(0, LIMITE_ANO - x.total))}</strong>
                  </td>
                  <td>
                    <span className="limite-barra">
                      <span className={p >= 90 ? "alto" : p >= 75 ? "medio" : undefined} style={{ width: `${Math.min(100, p)}%` }} />
                    </span>
                  </td>
                  <td className="n discreto">{kg(p, p >= 90 ? 1 : 0)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="nota" style={{ marginTop: 16 }}>
          <p>
            • Limite da Chamada Pública: <strong>R$ 40.000 por produtor, por ano</strong> (janeiro a dezembro). Em janeiro de {Number(l.ano) + 1} zera.
          </p>
          <p>• Conta o que foi pago pela Prefeitura (preço de venda). O que o produtor trouxe a mais que o pedido não é pago, então não conta.</p>
          {perto.length > 0 && (
            <p>
              • <strong>{perto.map((x) => x.curto).join(" e ")}</strong> {perto.length > 1 ? "estão" : "está"} com 90% ou mais do limite.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
