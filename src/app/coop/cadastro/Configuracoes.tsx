"use client";

import { useState } from "react";
import type { ExcecaoEscola } from "@/lib/coop/tipos";
import { salvarConfiguracoes, salvarExcecaoEscola } from "../acoes";
import { Aviso, useAcao } from "../ui";

export function Configuracoes({ nome, cidade, equipe }: { nome: string; cidade: string; equipe: string[] }) {
  const [n, setN] = useState(nome);
  const [c, setC] = useState(cidade);
  const [eq, setEq] = useState(equipe.join("\n"));
  const { pendente, aviso, rodar } = useAcao();
  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Dados da cooperativa e equipe do galpão</h2>
      <div className="botoes" style={{ alignItems: "flex-start" }}>
        <label className="campo">
          Nome da cooperativa (aparece no app e nas impressões)
          <input type="text" value={n} onChange={(e) => setN(e.target.value)} style={{ width: 340 }} placeholder="Cooperativa dos Produtores Rurais" />
        </label>
        <label className="campo">
          Cidade
          <input type="text" value={c} onChange={(e) => setC(e.target.value)} style={{ width: 200 }} />
        </label>
        <label className="campo">
          Equipe do galpão (um nome por linha; aparece ao anotar quem conferiu)
          <textarea value={eq} onChange={(e) => setEq(e.target.value)} style={{ minHeight: 90, width: 260 }} placeholder={"Clodomir\nJuliana"} />
        </label>
      </div>
      <div className="botoes" style={{ marginTop: 8 }}>
        <button type="button" className="botao" disabled={pendente} onClick={() => rodar(() => salvarConfiguracoes({ nomeCooperativa: n, cidade: c, equipe: eq.split("\n").map((t) => t.trim()).filter(Boolean) }))}>
          {pendente ? "Salvando…" : "Salvar"}
        </button>
      </div>
      <Aviso aviso={aviso} />
    </div>
  );
}

interface EscolaOpc {
  codigo: string;
  nome: string;
}

export function ExcecoesEscolas({ escolas, produtos, excecoes }: { escolas: EscolaOpc[]; produtos: string[]; excecoes: Record<string, ExcecaoEscola> }) {
  const [codigo, setCodigo] = useState("");
  const [busca, setBusca] = useState("");
  const [naoRecebe, setNaoRecebe] = useState(true);
  const [prods, setProds] = useState<string[]>([]);
  const [motivo, setMotivo] = useState("");
  const { pendente, aviso, rodar } = useAcao();
  const semAcento = (t: string) => t.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const achadas = busca.trim().length >= 2 ? escolas.filter((e) => e.codigo.startsWith(busca.trim()) || semAcento(e.nome).includes(semAcento(busca))).slice(0, 8) : [];
  const nomes = new Map(escolas.map((e) => [e.codigo, e.nome]));
  const lista = Object.entries(excecoes);
  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Escolas que não recebem</h2>
      <p className="discreto" style={{ marginTop: 0 }}>
        Ex.: escola que não faz almoço. Quando o pedido da Prefeitura chegar, o app tira essas escolas (ou só esses produtos) e lembra de avisar a nutrição.
      </p>
      {lista.length > 0 && (
        <table className="tabela" style={{ marginBottom: 12 }}>
          <tbody>
            {lista.map(([cod, ex]) => (
              <tr key={cod}>
                <td>{cod}</td>
                <td>
                  <strong>{nomes.get(cod) ?? "?"}</strong>
                </td>
                <td>{ex.naoRecebe ? <span className="etiqueta vermelha">Não recebe nada</span> : <span className="etiqueta amarela">Sem {ex.produtos?.join(", ")}</span>}</td>
                <td className="discreto">{ex.motivo}</td>
                <td className="direita">
                  <button type="button" className="botao pequeno claro" disabled={pendente} onClick={() => rodar(() => salvarExcecaoEscola(cod, null), "Tirado.")}>
                    Tirar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="botoes" style={{ alignItems: "flex-end" }}>
        <label className="campo">
          Escola
          {codigo ? (
            <span className="botoes">
              <strong>
                {codigo} · {nomes.get(codigo)}
              </strong>
              <button type="button" className="botao pequeno claro" onClick={() => setCodigo("")}>
                Trocar
              </button>
            </span>
          ) : (
            <input data-livre type="text" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="código ou nome" style={{ width: 240 }} />
          )}
        </label>
        {!codigo && achadas.length > 0 && (
          <span className="botoes">
            {achadas.map((e) => (
              <button key={e.codigo} type="button" className="botao pequeno claro" onClick={() => { setCodigo(e.codigo); setBusca(""); }}>
                {e.codigo} · {e.nome}
              </button>
            ))}
          </span>
        )}
      </div>
      {codigo && (
        <div className="botoes" style={{ marginTop: 8, alignItems: "flex-end" }}>
          <label className="campo">
            O que não recebe
            <select value={naoRecebe ? "tudo" : "alguns"} onChange={(e) => setNaoRecebe(e.target.value === "tudo")}>
              <option value="tudo">nada (não recebe nenhum produto)</option>
              <option value="alguns">só alguns produtos</option>
            </select>
          </label>
          {!naoRecebe && (
            <label className="campo">
              Produtos
              <select multiple value={prods} onChange={(e) => setProds([...e.target.selectedOptions].map((o) => o.value))} style={{ minHeight: 120 }}>
                {produtos.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
          )}
          <label className="campo">
            Motivo
            <input type="text" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="ex.: não faz almoço" style={{ width: 220 }} />
          </label>
          <button
            type="button"
            className="botao"
            disabled={pendente || (!naoRecebe && prods.length === 0)}
            onClick={() =>
              rodar(() => salvarExcecaoEscola(codigo, { naoRecebe, produtos: naoRecebe ? undefined : prods, motivo }), "Escola anotada.", () => {
                setCodigo("");
                setMotivo("");
                setProds([]);
              })
            }
          >
            Anotar
          </button>
        </div>
      )}
      <Aviso aviso={aviso} />
    </div>
  );
}
