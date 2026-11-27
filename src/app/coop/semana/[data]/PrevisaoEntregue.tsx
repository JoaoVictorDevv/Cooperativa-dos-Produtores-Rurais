import Link from "next/link";
import type { ResultadoSemana } from "@/lib/coop/motor";
import { kg } from "@/lib/coop/numeros";
import type { Previsao } from "@/lib/coop/previsao";
import { referenciaDeData } from "@/lib/coop/semana";
import type { Cadastro } from "@/lib/coop/tipos";

// Adicional (fim da tela): o que cada produtor prometeu na previsão × o que pediram × o que trouxe.
export function PrevisaoEntregue({ cad, r, prev }: { cad: Cadastro; r: ResultadoSemana; prev: Previsao }) {
  const linhas = prev.itens
    .map((i) => {
      const x = r.produtores[i.produtor]?.[i.produto];
      return { ...i, pedido: x?.pedido ?? 0, entregue: x?.entregue ?? 0 };
    })
    .filter((l) => l.kg > 0);
  if (!linhas.length) return null;
  const temEntrega = r.resumo.entregasLancadasKg > 0;
  const prometido = linhas.reduce((s, l) => s + l.kg, 0);
  // Comparação certa: o que trouxe × o que pedimos. O prometido fica só para saber quanto ele tinha.
  const pedidas = linhas.filter((l) => l.pedido > 0.004);
  const pedido = pedidas.reduce((s, l) => s + l.pedido, 0);
  const trouxe = pedidas.reduce((s, l) => s + l.entregue, 0);
  const pct = pedido > 0 ? (trouxe / pedido) * 100 : 0;
  const nome = new Map(cad.produtores.map((p) => [p.id, p.curto || p.nome]));
  const ordem = cad.produtores.map((p) => p.id);
  linhas.sort((a, b) => ordem.indexOf(a.produtor) - ordem.indexOf(b.produtor));
  return (
    <details className="adicional">
      <summary>
        Adicional: previsão × entregue
        <small>
          {temEntrega
            ? `trouxeram ${kg(pct, 0)}% do pedido (${kg(trouxe, 0)} de ${kg(pedido, 0)} kg) · tinham para oferecer ${kg(prometido, 0)} kg`
            : `tinham para oferecer ${kg(prometido, 0)} kg — ainda sem entrega no galpão`}
        </small>
      </summary>
      <div className="dentro">
        <p className="discreto">
          Previsão da entrega de {referenciaDeData(prev.data).slice(0, 5)} (<Link href={`/coop/previsao?data=${prev.data}`}>abrir</Link>). <strong>Tinha para oferecer</strong> = o que ele disse na previsão. A barra compara o que <strong>trouxe</strong> com o que foi <strong>pedido</strong>.
        </p>
        <div className="rolar">
          <table className="tabela">
            <thead>
              <tr>
                <th>Produtor</th>
                <th>Produto</th>
                <th className="n">Tinha para oferecer</th>
                <th className="n">Pedido</th>
                <th className="n">Trouxe</th>
                <th>Trouxe do pedido</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l, k) => {
                const p = l.pedido > 0.004 ? (l.entregue / l.pedido) * 100 : null;
                return (
                  <tr key={`${l.produtor}-${l.produto}`}>
                    <td>{k === 0 || linhas[k - 1].produtor !== l.produtor ? nome.get(l.produtor) ?? l.produtor : ""}</td>
                    <td>{l.produto}</td>
                    <td className="n">{kg(l.kg)}</td>
                    <td className="n">{l.pedido > 0 ? kg(l.pedido) : "—"}</td>
                    <td className="n">{temEntrega ? kg(l.entregue) : "—"}</td>
                    <td>
                      {temEntrega && p === null && <span className="discreto">não foi pedido</span>}
                      {temEntrega && p !== null && (
                        <>
                          <span className={`barra-pct${p < 95 ? " pouco" : ""}`} style={{ width: Math.min(100, p) * 0.8 }} /> {kg(p, 0)}%
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </details>
  );
}
