"use client";

import { useState } from "react";
import { kg, reais } from "@/lib/coop/numeros";
import { NOMES_CUSTOS } from "@/lib/coop/semana";
import type { Custos } from "@/lib/coop/tipos";
import { lerConferenciaPrefeitura, salvarFechamento } from "../../../acoes";
import { Aviso, CampoNumero, lerNumero, mostrarNumero, useAcao } from "../../../ui";

interface LinhaConf {
  produto: string;
  pedido: number;
  aceitoEscolas: number;
  conferido: number | null;
  preco: number;
}

interface ProdutorPag {
  id: string;
  nome: string;
  aPagar: number; // antes do desconto
  desconto: number;
}

export function Fechamento({
  data,
  produtos,
  custos,
  conferidos,
  produtores,
  observacao,
  escala,
}: {
  data: string;
  produtos: LinhaConf[];
  custos: Custos;
  conferidos: boolean;
  produtores: ProdutorPag[];
  observacao: string;
  escala: { diarias: number; diaria: number; total: number };
}) {
  const [obs, setObs] = useState(observacao);
  const [desc, setDesc] = useState<Record<string, string>>(() => Object.fromEntries(produtores.map((p) => [p.id, p.desconto > 0 ? mostrarNumero(p.desconto) : ""])));
  const [conf, setConf] = useState<Record<string, string>>(() => Object.fromEntries(produtos.map((p) => [p.produto, mostrarNumero(p.conferido)])));
  const [c, setC] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(custos).map(([k, v]) => [k, mostrarNumero(v)])));
  const [rom, setRom] = useState(conferidos);
  const leitura = useAcao();
  const { pendente, aviso, rodar } = useAcao();
  const todosNumeros = [...Object.values(conf), ...Object.values(c), ...Object.values(desc)].every((t) => !Number.isNaN(lerNumero(t)));

  function salvar() {
    const conferido: Record<string, number> = {};
    for (const p of produtos) {
      const v = lerNumero(conf[p.produto]);
      if (v !== null) conferido[p.produto] = v;
    }
    const custosNum = Object.fromEntries(Object.keys(custos).map((k) => [k, lerNumero(c[k]) ?? 0])) as unknown as Custos;
    const descontos: Record<string, number> = {};
    for (const p of produtores) {
      const v = lerNumero(desc[p.id]);
      if (v !== null && !Number.isNaN(v) && v > 0) descontos[p.id] = v;
    }
    rodar(() => salvarFechamento(data, { conferido, custos: custosNum, romaneiosConferidos: rom, descontos, observacao: obs }), "Fechamento salvo.");
  }

  return (
    <>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Conferência da Prefeitura</h2>
        <p className="discreto" style={{ marginTop: 0 }}>
          Quando chegar o e-mail com a conferência, traga o arquivo (ou digite o “total entregue” de cada produto). Com a conferência, cobra o que a Prefeitura conferiu. Sem ela, cobra
          o que as escolas aceitaram.
        </p>
        <form
          className="botoes"
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            leitura.rodar(
              () => lerConferenciaPrefeitura(form),
              "Conferência lida. Confira e clique em Salvar.",
              (r) => {
                if ("entregue" in r) setConf((old) => ({ ...old, ...Object.fromEntries(produtos.map((p) => [p.produto, mostrarNumero(r.entregue[p.produto] ?? 0)])) }));
              },
            );
          }}
        >
          <input type="file" name="arquivo" accept=".xlsx" required />
          <button className="botao claro" disabled={leitura.pendente}>
            {leitura.pendente ? "Lendo…" : "Ler conferência"}
          </button>
        </form>
        <Aviso aviso={leitura.aviso} />
        <div className="rolar">
          <table className="tabela">
            <thead>
              <tr>
                <th>Produto</th>
                <th className="n">Pedido</th>
                <th className="n">Aceito nas escolas</th>
                <th className="n">Conferido pela Prefeitura</th>
                <th className="n">Diferença</th>
                <th className="n">Valor</th>
              </tr>
            </thead>
            <tbody>
              {produtos.map((p) => {
                const v = lerNumero(conf[p.produto]);
                const usado = v === null || Number.isNaN(v) ? p.aceitoEscolas : Math.min(v, p.pedido);
                const dif = v === null || Number.isNaN(v) ? null : v - p.aceitoEscolas;
                return (
                  <tr key={p.produto}>
                    <td>{p.produto}</td>
                    <td className="n">{kg(p.pedido)}</td>
                    <td className="n">{kg(p.aceitoEscolas)}</td>
                    <td className="n">
                      <CampoNumero rotulo={`Conferido ${p.produto}`} valor={conf[p.produto]} aoMudar={(t) => setConf({ ...conf, [p.produto]: t })} />
                    </td>
                    <td className="n">{dif === null || Math.abs(dif) < 0.005 ? "—" : <span className={dif < 0 ? "etiqueta vermelha" : "etiqueta amarela"}>{kg(dif)}</span>}</td>
                    <td className="n">{reais(usado * p.preco)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Custos da semana</h2>
        <p className="discreto" style={{ marginTop: 0 }}>
          Já vieram os da semana anterior. Mude só o que mudou.
        </p>
        <div className="grade">
          {NOMES_CUSTOS.map(([k, nome]) => (
            <label key={k} className="campo">
              {k === "montagem" ? "Montagem (ajudantes)" : nome}
              <CampoNumero rotulo={nome} valor={c[k]} aoMudar={(t) => setC({ ...c, [k]: t })} largura={140} />
              {k === "montagem" && escala.total > 0 && (
                <span className="discreto" style={{ fontSize: 12.5 }}>
                  Pela escala: {escala.diarias} diárias × {reais(escala.diaria)} = {reais(escala.total)}
                  {(lerNumero(c.montagem) ?? 0) !== escala.total && (
                    <>
                      {" "}
                      <button type="button" className="botao pequeno claro" onClick={() => setC({ ...c, montagem: mostrarNumero(escala.total) })}>
                        usar
                      </button>
                    </>
                  )}
                </span>
              )}
            </label>
          ))}
          <label className="campo">
            Administrativo — ficou faltando (entra no custo; é dívida)
            <CampoNumero rotulo="Administrativo falta pagar" valor={c.administrativoFalta} aoMudar={(t) => setC({ ...c, administrativoFalta: t })} largura={140} />
          </label>
        </div>
        <details className="adicional" open={produtores.some((p) => p.desconto > 0)} style={{ marginTop: 14 }}>
          <summary>
            Descontar de algum produtor?<small>ex.: entregou folha estragada e a escola devolveu — só se precisar</small>
          </summary>
          <div className="dentro">
            <p className="discreto" style={{ marginTop: 0 }}>
              Digite o valor em R$ no amarelo do produtor: ele sai do que o produtor recebe (coluna Líquido). Em branco = sem desconto.
            </p>
            <div className="rolar">
          <table className="tabela">
            <thead>
              <tr>
                <th>Produtor</th>
                <th className="n">A pagar</th>
                <th className="n">Desconto (R$)</th>
                <th className="n">Líquido</th>
              </tr>
            </thead>
            <tbody>
              {produtores.map((p) => {
                const d = lerNumero(desc[p.id]);
                return (
                  <tr key={p.id}>
                    <td>{p.nome}</td>
                    <td className="n">{reais(p.aPagar)}</td>
                    <td className="n">
                      <CampoNumero rotulo={`Desconto ${p.nome}`} valor={desc[p.id]} aoMudar={(t) => setDesc({ ...desc, [p.id]: t })} />
                    </td>
                    <td className="n">
                      <strong>{reais(p.aPagar - (d && !Number.isNaN(d) ? d : 0))}</strong>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
            </div>
          </div>
        </details>
        <label className="campo" style={{ marginTop: 14 }}>
          Uma linha sobre a semana (aparece no Resumo das entregas)
          <input type="text" value={obs} onChange={(e) => setObs(e.target.value)} placeholder="ex.: van quebrou na segunda: 9 escolas sem entrega" style={{ maxWidth: 520 }} />
        </label>
        <label style={{ display: "block", marginTop: 14 }}>
          <input type="checkbox" checked={rom} onChange={(e) => setRom(e.target.checked)} /> Romaneios das escolas conferidos (todos voltaram e foram lançados)
        </label>
        <div className="botoes" style={{ marginTop: 12 }}>
          <button type="button" className="botao" disabled={pendente || !todosNumeros} onClick={salvar}>
            {pendente ? "Salvando…" : "Salvar fechamento"}
          </button>
        </div>
        <Aviso aviso={aviso} />
      </div>
    </>
  );
}
