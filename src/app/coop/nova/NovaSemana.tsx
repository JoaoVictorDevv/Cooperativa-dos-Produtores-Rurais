"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { analisarPedido, criarSemana } from "../acoes";
import { kg } from "@/lib/coop/numeros";
import { MODALIDADES, type LinhaPedido } from "@/lib/coop/planilha/pedidoPrefeitura";
import { Aviso, useAcao } from "../ui";

const PARES: [string, string][] = [
  ["DOMINGO", "SEGUNDA"],
  ["SEGUNDA", "TERÇA"],
  ["SÁBADO", "DOMINGO"],
  ["TERÇA", "QUARTA"],
];

type Lido = {
  linhas: LinhaPedido[];
  totalPrefeitura: Record<string, number>;
  foraDaLista: Record<string, number>;
  semCodigo: string[];
  desconhecidas: string[];
  previsao: Record<string, number> | null;
};

export function NovaSemana(p: { dataSugerida: string; entregaSugerida: number; diasSugeridos: [string, string]; semanas: string[]; produtos: string[] }) {
  const router = useRouter();
  const [data, setData] = useState(p.dataSugerida);
  const [entrega, setEntrega] = useState(String(p.entregaSugerida));
  const [dias, setDias] = useState(p.diasSugeridos.join("|"));
  const [lido, setLido] = useState<Lido | null>(null);
  const [cortes, setCortes] = useState<Set<string>>(new Set());
  const [substituir, setSubstituir] = useState(false);
  const leitura = useAcao();
  const criacao = useAcao();

  const tabela = useMemo(() => {
    if (!lido) return [];
    return p.produtos
      .map((produto) => {
        const porMod = Object.fromEntries(MODALIDADES.map((m) => [m, 0])) as Record<string, number>;
        for (const l of lido.linhas) if (l.produto === produto) porMod[l.modalidade] += l.kg;
        const total = Object.values(porMod).reduce((a, b) => a + b, 0);
        const fica = MODALIDADES.reduce((s, m) => s + (cortes.has(`${m}|${produto}`) ? 0 : porMod[m]), 0);
        return { produto, porMod, total, fica, previsao: lido.previsao?.[produto] ?? null, prefeitura: lido.totalPrefeitura[produto] ?? null };
      })
      .filter((x) => x.total > 0);
  }, [lido, cortes, p.produtos]);

  const totalFica = tabela.reduce((s, x) => s + x.fica, 0);
  const totalPedido = tabela.reduce((s, x) => s + x.total, 0);

  function alternar(chave: string) {
    setCortes((c) => {
      const n = new Set(c);
      if (n.has(chave)) n.delete(chave);
      else n.add(chave);
      return n;
    });
  }

  return (
    <>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>1. Dados da semana</h2>
        <div className="botoes" style={{ alignItems: "flex-end" }}>
          <label className="campo">
            Data de referência
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </label>
          <label className="campo">
            Nº da entrega
            <input type="number" min={1} value={entrega} onChange={(e) => setEntrega(e.target.value)} style={{ width: 90 }} />
          </label>
          <label className="campo">
            Dias que os produtores trazem no galpão
            <select value={dias} onChange={(e) => setDias(e.target.value)}>
              {PARES.map((d) => (
                <option key={d.join("|")} value={d.join("|")}>
                  {d[0]} e {d[1]}
                  {d[0] === "SEGUNDA" ? " (feriado)" : ""}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>2. Pedido da Prefeitura</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            form.set("data", data);
            leitura.rodar(
              () => analisarPedido(form),
              "Pedido lido.",
              (r) => {
                if ("linhas" in r) {
                  setLido(r);
                  setCortes(new Set());
                }
              },
            );
          }}
        >
          <div className="botoes">
            <input type="file" name="arquivo" accept=".xlsx" required />
            <button className="botao" disabled={leitura.pendente}>
              {leitura.pendente ? "Lendo…" : "Ler pedido"}
            </button>
          </div>
        </form>
        <Aviso aviso={leitura.aviso} />
        {lido && (
          <>
            {lido.desconhecidas.length > 0 && (
              <p className="erro">Escolas que não estão no cadastro: {lido.desconhecidas.join(", ")}. Atualize o MODELO antes de criar a semana.</p>
            )}
            {Object.keys(lido.foraDaLista).length > 0 && (
              <p className="aviso">
                Produtos que a cooperativa não vende (ficam de fora):{" "}
                {Object.entries(lido.foraDaLista)
                  .map(([n, v]) => `${n} ${kg(v)} kg`)
                  .join(", ")}
              </p>
            )}
            {lido.semCodigo.length > 0 && <p className="aviso">Linhas sem código de escola (ficam de fora): {lido.semCodigo.join("; ")}</p>}
            <h3>Cortes da nutricionista</h3>
            <p className="discreto">Clique no número para cortar aquele produto daquela modalidade (fica riscado). Ex.: 26/10 cortou cenoura da CEI e cheiro verde da CEI e da Integral.</p>
            <div className="rolar">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Produto</th>
                    {MODALIDADES.map((m) => (
                      <th key={m} className="n">
                        {m}
                      </th>
                    ))}
                    <th className="n">Pedido</th>
                    <th className="n">Fica</th>
                    <th className="n">Previsão</th>
                    <th>Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {tabela.map((x) => {
                    const falta = x.previsao !== null && x.fica > x.previsao + 0.004;
                    const confere = x.prefeitura === null || Math.abs(x.prefeitura - x.total) < 0.05;
                    return (
                      <tr key={x.produto}>
                        <td>{x.produto}</td>
                        {MODALIDADES.map((m) => {
                          const chave = `${m}|${x.produto}`;
                          const v = x.porMod[m];
                          if (v <= 0) return <td key={m} className="n discreto">—</td>;
                          const cortado = cortes.has(chave);
                          return (
                            <td key={m} className="n">
                              <button
                                type="button"
                                className="botao pequeno claro"
                                style={cortado ? { textDecoration: "line-through", borderColor: "var(--c-vermelho)", color: "var(--c-vermelho)" } : undefined}
                                onClick={() => alternar(chave)}
                                title={cortado ? "Cortado — clique para voltar" : "Clique para cortar"}
                              >
                                {kg(v)}
                              </button>
                            </td>
                          );
                        })}
                        <td className="n">{kg(x.total)}</td>
                        <td className="n">
                          <strong>{kg(x.fica)}</strong>
                        </td>
                        <td className="n">{x.previsao === null ? "—" : kg(x.previsao)}</td>
                        <td>
                          {falta && <span className="etiqueta vermelha">previsão menor</span>} {!confere && <span className="etiqueta amarela">TOTAL da Prefeitura: {kg(x.prefeitura ?? 0)}</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={MODALIDADES.length + 1}>Total</td>
                    <td className="n">{kg(totalPedido)}</td>
                    <td className="n">{kg(totalFica)}</td>
                    <td className="n">{lido.previsao ? kg(Object.values(lido.previsao).reduce((a, b) => a + b, 0)) : "—"}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
            {!lido.previsao && <p className="discreto">Sem previsão gravada para essa data (tela Previsão). A coluna Previsão fica vazia.</p>}
          </>
        )}
      </div>

      {lido && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>3. Criar a semana</h2>
          <p className="discreto">
            {(() => {
              const ant = p.semanas.filter((d) => d < data).sort().at(-1);
              return ant ? `Os custos já vêm da semana ${ant.split("-").reverse().join("/")}. Depois você só muda o que mudou.` : "Não há semana anterior: os custos começam zerados.";
            })()}
          </p>
          <div className="botoes">
            <label className="discreto">
              <input type="checkbox" checked={substituir} onChange={(e) => setSubstituir(e.target.checked)} /> substituir se essa data já existir
            </label>
            <button
              className="botao"
              disabled={criacao.pendente || !data || lido.desconhecidas.length > 0}
              onClick={() =>
                criacao.rodar(
                  () =>
                    criarSemana({
                      data,
                      entrega: Number(entrega),
                      dias: dias.split("|") as [string, string],
                      linhas: lido.linhas,
                      cortes: [...cortes],
                      substituir,
                    }),
                  "Semana criada.",
                  (r) => "data" in r && router.push(`/coop/semana/${r.data}/pedido`),
                )
              }
            >
              {criacao.pendente ? "Criando…" : `Criar semana com ${kg(totalFica)} kg`}
            </button>
          </div>
          <Aviso aviso={criacao.aviso} />
        </div>
      )}
    </>
  );
}
