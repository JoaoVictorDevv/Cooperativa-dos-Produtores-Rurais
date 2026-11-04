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

export function Fechamento({ data, produtos, custos, conferidos }: { data: string; produtos: LinhaConf[]; custos: Custos; conferidos: boolean }) {
  const [conf, setConf] = useState<Record<string, string>>(() => Object.fromEntries(produtos.map((p) => [p.produto, mostrarNumero(p.conferido)])));
  const [c, setC] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(custos).map(([k, v]) => [k, mostrarNumero(v)])));
  const [rom, setRom] = useState(conferidos);
  const leitura = useAcao();
  const { pendente, aviso, rodar } = useAcao();
  const todosNumeros = [...Object.values(conf), ...Object.values(c)].every((t) => !Number.isNaN(lerNumero(t)));

  function salvar() {
    const conferido: Record<string, number> = {};
    for (const p of produtos) {
      const v = lerNumero(conf[p.produto]);
      if (v !== null) conferido[p.produto] = v;
    }
    const custosNum = Object.fromEntries(Object.keys(custos).map((k) => [k, lerNumero(c[k]) ?? 0])) as unknown as Custos;
    rodar(() => salvarFechamento(data, { conferido, custos: custosNum, romaneiosConferidos: rom }), "Fechamento salvo.");
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
              {nome}
              <CampoNumero rotulo={nome} valor={c[k]} aoMudar={(t) => setC({ ...c, [k]: t })} largura={140} />
            </label>
          ))}
          <label className="campo">
            Administrativo — falta pagar (só informação)
            <CampoNumero rotulo="Administrativo falta pagar" valor={c.administrativoFalta} aoMudar={(t) => setC({ ...c, administrativoFalta: t })} largura={140} />
          </label>
        </div>
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
