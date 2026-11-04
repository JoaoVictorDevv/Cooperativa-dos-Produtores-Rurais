"use client";

import { useMemo, useState } from "react";
import { arred, kg } from "@/lib/coop/numeros";
import { salvarEntrega } from "../../../../acoes";
import { Aviso, CampoNumero, lerNumero, mostrarNumero, useAcao } from "../../../../ui";

export interface CartaoProdutor {
  id: string;
  nome: string;
  curto: string;
  lancado: boolean;
  itens: { produto: string; unidade: string; planejado: number; entregue: number | null; extra: number | null }[];
}

export function Galpao({ data, dia, cartoes, caixa }: { data: string; dia: "1" | "2"; cartoes: CartaoProdutor[]; caixa: { grande: number; pequena: number } }) {
  const [busca, setBusca] = useState("");
  const [soPendentes, setSoPendentes] = useState(false);
  const lista = cartoes.filter((c) => (!soPendentes || !c.lancado) && c.nome.toLowerCase().includes(busca.toLowerCase()));
  const lancados = cartoes.filter((c) => c.lancado).length;
  return (
    <>
      <div className="botoes nao-imprimir" style={{ margin: "10px 0" }}>
        <input type="text" placeholder="Procurar produtor…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <label className="discreto">
          <input type="checkbox" checked={soPendentes} onChange={(e) => setSoPendentes(e.target.checked)} /> só quem falta lançar
        </label>
        <span className="etiqueta">
          {lancados} de {cartoes.length} lançados
        </span>
      </div>
      {lista.map((c) => (
        <Cartao key={c.id} data={data} dia={dia} c={c} caixa={caixa} />
      ))}
    </>
  );
}

type Linha = { balanca: string; grandes: string; pequenas: string; liquido: string; extra: string };

function Cartao({ data, dia, c, caixa }: { data: string; dia: "1" | "2"; c: CartaoProdutor; caixa: { grande: number; pequena: number } }) {
  const [todos, setTodos] = useState(false);
  const [comExtra, setComExtra] = useState(c.itens.some((i) => i.extra !== null));
  const [v, setV] = useState<Record<string, Linha>>(() =>
    Object.fromEntries(c.itens.map((i) => [i.produto, { balanca: "", grandes: "", pequenas: "", liquido: mostrarNumero(i.entregue), extra: mostrarNumero(i.extra) }])),
  );
  const { pendente, aviso, rodar } = useAcao();
  const visiveis = c.itens.filter((i) => todos || i.planejado > 0.004 || i.entregue !== null || i.extra !== null);

  // Líquido = balança − caixas. Se o João digitou o líquido direto, vale o digitado.
  const liquido = (l: Linha): number | null => {
    const b = lerNumero(l.balanca);
    if (b !== null && !Number.isNaN(b)) {
      const g = lerNumero(l.grandes) ?? 0;
      const p = lerNumero(l.pequenas) ?? 0;
      return Math.max(0, arred(b - (Number.isNaN(g) ? 0 : g) * caixa.grande - (Number.isNaN(p) ? 0 : p) * caixa.pequena));
    }
    const d = lerNumero(l.liquido);
    return d === null || Number.isNaN(d) ? null : d;
  };
  const invalido = Object.values(v).some((l) => [l.balanca, l.grandes, l.pequenas, l.liquido, l.extra].some((t) => Number.isNaN(lerNumero(t))));
  const total = useMemo(() => c.itens.reduce((s, i) => s + (liquido(v[i.produto]) ?? i.planejado), 0), [v, c.itens]); // eslint-disable-line react-hooks/exhaustive-deps

  function salvar(modo: "normal" | "tudoCerto" | "naoVeio") {
    const valores: Record<string, number | null> = {};
    const extras: Record<string, number | null> = {};
    for (const i of c.itens) {
      const l = v[i.produto];
      const x = liquido(l);
      // Em branco = veio o pedido do dia (a planilha pagaria 0 se ficasse em branco).
      if (modo === "naoVeio") valores[i.produto] = i.planejado > 0.004 ? 0 : null;
      else if (modo === "tudoCerto") valores[i.produto] = i.planejado > 0.004 ? i.planejado : x;
      else valores[i.produto] = x ?? (i.planejado > 0.004 ? i.planejado : null);
      const e = lerNumero(l.extra);
      extras[i.produto] = e === null || Number.isNaN(e) || e === 0 ? null : e;
    }
    rodar(async () => {
      const a = await salvarEntrega(data, dia, c.id, valores);
      if (!a.ok || !comExtra) return a;
      return salvarEntrega(data, "extra", c.id, extras);
    }, modo === "naoVeio" ? "Marcado: não veio." : "Lançado.");
    if (modo !== "normal") {
      setV((old) =>
        Object.fromEntries(
          c.itens.map((i) => [
            i.produto,
            { ...old[i.produto], balanca: "", grandes: "", pequenas: "", liquido: i.planejado > 0.004 ? mostrarNumero(modo === "naoVeio" ? 0 : i.planejado) : old[i.produto].liquido },
          ]),
        ),
      );
    }
  }

  return (
    <div className="card">
      <div className="botoes" style={{ justifyContent: "space-between" }}>
        <div>
          <strong style={{ fontSize: 17 }}>{c.nome}</strong> {c.lancado ? <span className="etiqueta verde">lançado</span> : <span className="etiqueta amarela">falta lançar</span>}
        </div>
        <div className="botoes nao-imprimir">
          <label className="discreto">
            <input type="checkbox" checked={todos} onChange={(e) => setTodos(e.target.checked)} /> todos os produtos
          </label>
          <label className="discreto">
            <input type="checkbox" checked={comExtra} onChange={(e) => setComExtra(e.target.checked)} /> entrega extra (complemento)
          </label>
        </div>
      </div>
      <div className="rolar">
        <table className="tabela">
          <thead>
            <tr>
              <th>Produto</th>
              <th className="n">Pedido do dia</th>
              <th className="n">Balança (kg)</th>
              <th className="n">Cx grandes</th>
              <th className="n">Cx pequenas</th>
              <th className="n">Entregou (líquido)</th>
              {comExtra && <th className="n">Extra</th>}
              <th className="n">Diferença</th>
            </tr>
          </thead>
          <tbody>
            {visiveis.map((i) => {
              const l = v[i.produto];
              const x = liquido(l);
              const temBalanca = lerNumero(l.balanca) !== null;
              const dif = x === null ? 0 : arred(x - i.planejado);
              const set = (campo: keyof Linha) => (t: string) => setV({ ...v, [i.produto]: { ...l, [campo]: t } });
              return (
                <tr key={i.produto} className={i.planejado <= 0.004 ? "cinza" : undefined}>
                  <td>{i.produto}</td>
                  <td className="n">
                    <strong>{kg(i.planejado)}</strong> {i.unidade}
                  </td>
                  <td className="n">
                    <CampoNumero rotulo={`Balança ${i.produto}`} valor={l.balanca} aoMudar={set("balanca")} largura={84} />
                  </td>
                  <td className="n">
                    <CampoNumero rotulo={`Caixas grandes ${i.produto}`} valor={l.grandes} aoMudar={set("grandes")} largura={56} />
                  </td>
                  <td className="n">
                    <CampoNumero rotulo={`Caixas pequenas ${i.produto}`} valor={l.pequenas} aoMudar={set("pequenas")} largura={56} />
                  </td>
                  <td className="n">
                    {temBalanca ? (
                      <strong>{kg(x ?? 0)}</strong>
                    ) : (
                      <CampoNumero rotulo={`Entregou ${i.produto}`} valor={l.liquido} aoMudar={set("liquido")} placeholder={i.planejado > 0.004 ? mostrarNumero(i.planejado) : ""} />
                    )}
                  </td>
                  {comExtra && (
                    <td className="n">
                      <CampoNumero rotulo={`Extra ${i.produto}`} valor={l.extra} aoMudar={set("extra")} largura={70} />
                    </td>
                  )}
                  <td className="n">
                    {x === null ? (
                      <span className="discreto">veio o pedido</span>
                    ) : Math.abs(dif) < 0.005 ? (
                      "ok"
                    ) : (
                      <span className={dif < 0 ? "etiqueta vermelha" : "etiqueta amarela"}>
                        {dif > 0 ? "+" : ""}
                        {kg(dif)}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="botoes nao-imprimir" style={{ marginTop: 10 }}>
        <button type="button" className="botao" disabled={pendente || invalido} onClick={() => salvar("normal")}>
          {pendente ? "Salvando…" : "Salvar"}
        </button>
        <button type="button" className="botao claro" disabled={pendente} onClick={() => salvar("tudoCerto")}>
          Veio tudo certo
        </button>
        <button type="button" className="botao perigo" disabled={pendente} onClick={() => salvar("naoVeio")}>
          Não veio
        </button>
        <span className="discreto">Total do dia: {kg(total)} kg</span>
      </div>
      <Aviso aviso={aviso} />
    </div>
  );
}
