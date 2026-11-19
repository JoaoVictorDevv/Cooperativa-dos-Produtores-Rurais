"use client";

import { useState } from "react";
import { kg } from "@/lib/coop/numeros";
import { salvarAjustesDivisao, salvarCapacidadeSemana, salvarPrimeiroDia } from "../../../acoes";
import { Aviso, CampoNumero, lerNumero, mostrarNumero, useAcao } from "../../../ui";

export interface LinhaDivisao {
  produto: string;
  unidade: string;
  doisDias: boolean;
  pedido: number;
  falta: number;
  produtores: {
    id: string;
    nome: string;
    capacidadeMes: number;
    capacidadeSemana: number | null;
    calculado: number;
    manual: number | null;
    final: number;
    dia1Manual: number | null;
    dia1: number;
    dia2: number;
  }[];
}

export function Divisao({ data, linhas }: { data: string; linhas: LinhaDivisao[] }) {
  const [abertos, setAbertos] = useState<Set<string>>(new Set(linhas.filter((l) => l.falta >= 0.005).map((l) => l.produto)));
  return (
    <div className="card rolar">
      <table className="tabela">
        <thead>
          <tr>
            <th>Produto</th>
            <th className="n">Pedido</th>
            <th>Quem entrega</th>
            <th className="n">Falta</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <Linha
              key={l.produto}
              data={data}
              l={l}
              aberto={abertos.has(l.produto)}
              alternar={() =>
                setAbertos((a) => {
                  const n = new Set(a);
                  if (n.has(l.produto)) n.delete(l.produto);
                  else n.add(l.produto);
                  return n;
                })
              }
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Linha({ data, l, aberto, alternar }: { data: string; l: LinhaDivisao; aberto: boolean; alternar: () => void }) {
  const inicial = () => Object.fromEntries(l.produtores.map((p) => [p.id, { cap: mostrarNumero(p.capacidadeSemana), aj: mostrarNumero(p.manual), d1: mostrarNumero(p.dia1Manual) }]));
  const [v, setV] = useState(inicial);
  const { pendente, aviso, rodar } = useAcao();
  const comPedido = l.produtores.filter((p) => p.final > 0.004);
  const invalido = Object.values(v).some((x) => Number.isNaN(lerNumero(x.cap)) || Number.isNaN(lerNumero(x.aj)) || Number.isNaN(lerNumero(x.d1)));

  function salvar() {
    const cap: Record<string, number | null> = {};
    const aj: Record<string, number | null> = {};
    const d1: Record<string, number | null> = {};
    for (const p of l.produtores) {
      cap[p.id] = lerNumero(v[p.id].cap);
      aj[p.id] = lerNumero(v[p.id].aj);
      d1[p.id] = lerNumero(v[p.id].d1);
    }
    rodar(async () => {
      const a = await salvarCapacidadeSemana(data, { [l.produto]: cap });
      if (!a.ok) return a;
      const b = await salvarAjustesDivisao(data, Object.fromEntries(Object.entries(aj).map(([id, x]) => [id, { [l.produto]: x }])));
      if (!b.ok) return b;
      return salvarPrimeiroDia(data, Object.fromEntries(Object.entries(d1).map(([id, x]) => [id, { [l.produto]: x }])));
    });
  }

  return (
    <>
      <tr className={l.falta >= 0.005 ? "marcada" : undefined}>
        <td>
          <strong>{l.produto}</strong>
        </td>
        <td className="n">
          {kg(l.pedido)} {l.unidade}
        </td>
        <td>{comPedido.map((p) => `${p.nome} ${kg(p.final)}`).join(" · ") || <span className="discreto">ninguém</span>}</td>
        <td className="n">{l.falta >= 0.005 ? <span className="etiqueta vermelha">{kg(l.falta)}</span> : "—"}</td>
        <td className="direita">
          <button type="button" className="botao pequeno claro" onClick={alternar}>
            {aberto ? "Fechar" : "Mexer"}
          </button>
        </td>
      </tr>
      {aberto && (
        <tr>
          <td colSpan={5} style={{ background: "#fbfbf7" }}>
            <table className="tabela">
              <thead>
                <tr>
                  <th>Produtor</th>
                  <th className="n">Mapa de Produção (mês)</th>
                  <th className="n">Só esta semana</th>
                  <th className="n">Divisão automática</th>
                  <th className="n">Ajuste</th>
                  <th className="n">Pedido final</th>
                  <th className="n">1º dia</th>
                  <th className="n">2º dia</th>
                </tr>
              </thead>
              <tbody>
                {l.produtores.map((p) => (
                  <tr key={p.id}>
                    <td>{p.nome}</td>
                    <td className="n">{kg(p.capacidadeMes)}</td>
                    <td className="n">
                      <CampoNumero rotulo={`Só esta semana ${p.nome}`} valor={v[p.id].cap} aoMudar={(t) => setV({ ...v, [p.id]: { ...v[p.id], cap: t } })} />
                    </td>
                    <td className="n">{kg(p.calculado)}</td>
                    <td className="n">
                      <CampoNumero rotulo={`Ajuste ${p.nome}`} valor={v[p.id].aj} aoMudar={(t) => setV({ ...v, [p.id]: { ...v[p.id], aj: t } })} />
                    </td>
                    <td className="n">
                      <strong>{kg(p.final)}</strong>
                    </td>
                    <td className="n">
                      <CampoNumero rotulo={`1º dia ${p.nome}`} valor={v[p.id].d1} aoMudar={(t) => setV({ ...v, [p.id]: { ...v[p.id], d1: t } })} placeholder={mostrarNumero(p.dia1)} />
                    </td>
                    <td className="n">{kg(p.dia2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="botoes" style={{ marginTop: 8 }}>
              <button type="button" className="botao pequeno" disabled={pendente || invalido} onClick={salvar}>
                {pendente ? "Salvando…" : "Salvar e recalcular"}
              </button>
              <span className="discreto">Para quem não aparece aqui, coloque a quantidade no MODELO (Mapa de Produção) e traga de novo.</span>
            </div>
            <Aviso aviso={aviso} />
          </td>
        </tr>
      )}
    </>
  );
}
