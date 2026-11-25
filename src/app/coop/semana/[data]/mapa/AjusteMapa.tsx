"use client";

import { useState } from "react";
import { salvarAjusteEntrega } from "../../../acoes";
import { Aviso, CampoNumero, lerNumero, useAcao } from "../../../ui";

export interface LinhaAjuste {
  produto: string;
  doisDias: boolean; // tem entrega planejada no 2º dia
  automatico1: number; // % automático (0–100)
  automatico2: number;
  somarDias: boolean;
  fator1: number | null; // % digitado (0–100) ou null
  fator2: number | null;
}

const pct = (v: number) => `${Math.round(v * 10) / 10}%`.replace(".", ",");

// Igual a digitar por cima na aba _ENTREGA da planilha: em branco = automático.
export function AjusteMapa({
  data,
  linhas,
}: {
  data: string;
  linhas: LinhaAjuste[];
}) {
  const [aberto, setAberto] = useState(
    linhas.some((l) => l.somarDias || l.fator1 !== null || l.fator2 !== null),
  );
  const [v, setV] = useState(() =>
    Object.fromEntries(
      linhas.map((l) => [
        l.produto,
        {
          somar: l.somarDias,
          f1: l.fator1 === null ? "" : String(l.fator1).replace(".", ","),
          f2: l.fator2 === null ? "" : String(l.fator2).replace(".", ","),
        },
      ]),
    ),
  );
  const { pendente, aviso, rodar } = useAcao();
  const invalido = Object.values(v).some((x) =>
    [x.f1, x.f2].some((t) => {
      const n = lerNumero(t);
      return Number.isNaN(n) || (n !== null && n > 100);
    }),
  );
  if (!aberto)
    return (
      <div className="botoes nao-imprimir" style={{ margin: "6px 0 12px" }}>
        <button
          type="button"
          className="botao claro pequeno"
          onClick={() => setAberto(true)}
        >
          Ajuste manual do mapa (só se precisar)…
        </button>
        <span className="discreto">
          Normalmente não precisa: o app divide sozinho o que chegou no galpão.
        </span>
      </div>
    );
  function salvar() {
    const saida: Record<
      string,
      { somarDias?: boolean; fator1?: number; fator2?: number } | null
    > = {};
    for (const l of linhas) {
      const x = v[l.produto];
      const f1 = lerNumero(x.f1);
      const f2 = lerNumero(x.f2);
      const a: { somarDias?: boolean; fator1?: number; fator2?: number } = {};
      if (x.somar) a.somarDias = true;
      if (f1 !== null) a.fator1 = f1 / 100;
      if (f2 !== null) a.fator2 = f2 / 100;
      saida[l.produto] = Object.keys(a).length ? a : null;
    }
    rodar(() => salvarAjusteEntrega(data, saida), "Mapa recalculado.");
  }
  return (
    <div className="card nao-imprimir">
      <h3 style={{ marginTop: 0 }}>Ajuste manual do mapa</h3>
      <ul className="discreto" style={{ marginTop: 0, paddingLeft: 18 }}>
        <li>
          Cada número é <strong>quanto do pedido cada escola recebe</strong> naquele dia: <strong>100</strong> = o pedido todo, <strong>50</strong> = metade.
        </li>
        <li>
          <strong>Em branco = automático.</strong> O número cinza é o que o app calculou com o que chegou no galpão.
        </li>
        <li>Use só quando souber de algo que o app não sabe (ex.: vai chegar mais produto antes de o caminhão sair).</li>
        <li>
          <strong>Somar os 2 dias:</strong> para legume que chegou parte no 1º dia e parte no 2º (ex.: chuchu). Soma tudo antes de dividir.
        </li>
      </ul>
      <div className="rolar">
        <table className="tabela">
          <thead>
            <tr>
              <th>Produto</th>
              <th>Somar os 2 dias</th>
              <th className="n">Rotas de segunda (%)</th>
              <th className="n">Rotas de terça (%)</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => {
              const x = v[l.produto];
              const set = (k: "f1" | "f2") => (t: string) =>
                setV({ ...v, [l.produto]: { ...x, [k]: t } });
              return (
                <tr key={l.produto}>
                  <td>{l.produto}</td>
                  <td>
                    {l.doisDias ? (
                      <input
                        type="checkbox"
                        checked={x.somar}
                        onChange={(e) =>
                          setV({
                            ...v,
                            [l.produto]: { ...x, somar: e.target.checked },
                          })
                        }
                        aria-label={`Somar os 2 dias ${l.produto}`}
                      />
                    ) : (
                      <span className="discreto">—</span>
                    )}
                  </td>
                  <td className="n">
                    <CampoNumero
                      rotulo={`Segunda ${l.produto}`}
                      valor={x.f1}
                      aoMudar={set("f1")}
                      placeholder={pct(l.automatico1)}
                      largura={80}
                    />
                  </td>
                  <td className="n">
                    <CampoNumero
                      rotulo={`Terça ${l.produto}`}
                      valor={x.f2}
                      aoMudar={set("f2")}
                      placeholder={pct(l.automatico2)}
                      largura={80}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="botoes" style={{ marginTop: 8 }}>
        <button
          type="button"
          className="botao"
          disabled={pendente || invalido}
          onClick={salvar}
        >
          {pendente ? "Recalculando…" : "Salvar e recalcular o mapa"}
        </button>
        <button
          type="button"
          className="botao claro"
          onClick={() =>
            setV(
              Object.fromEntries(
                linhas.map((l) => [l.produto, { somar: false, f1: "", f2: "" }]),
              ),
            )
          }
        >
          Limpar tudo (voltar ao automático)
        </button>
        <button
          type="button"
          className="botao claro"
          onClick={() => setAberto(false)}
        >
          Fechar
        </button>
      </div>
      <Aviso aviso={aviso} />
    </div>
  );
}
