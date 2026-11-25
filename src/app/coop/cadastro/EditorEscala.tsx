"use client";

import Link from "next/link";
import { useState } from "react";
import { custoDaEscala, diariasDaEscala } from "@/lib/coop/escala";
import { reais } from "@/lib/coop/numeros";
import type { EscalaGalpao } from "@/lib/coop/tipos";
import { salvarEscala } from "../acoes";
import { Aviso, CampoNumero, lerNumero, mostrarNumero, useAcao } from "../ui";

// Escala do galpão: a mesma toda semana. A diária só aparece aqui (não sai na folha).
export function EditorEscala({ inicial }: { inicial: EscalaGalpao }) {
  const [e, setE] = useState<EscalaGalpao>(inicial);
  const [diaria, setDiaria] = useState(mostrarNumero(inicial.diaria));
  const [tarefas, setTarefas] = useState(inicial.tarefasChefe.join("\n"));
  const { pendente, aviso, rodar } = useAcao();
  const valor = lerNumero(diaria) ?? 0;
  const atual: EscalaGalpao = { ...e, diaria: Number.isNaN(valor) ? 0 : valor, tarefasChefe: tarefas.split("\n").map((t) => t.trim()).filter(Boolean) };
  const mudarPessoa = (d: number, i: number, novo: Partial<EscalaGalpao["dias"][number]["pessoas"][number]>) =>
    setE({ ...e, dias: e.dias.map((x, k) => (k === d ? { ...x, pessoas: x.pessoas.map((p, j) => (j === i ? { ...p, ...novo } : p)) } : x)) });
  return (
    <div className="card">
      <div className="botoes" style={{ justifyContent: "space-between" }}>
        <h2 style={{ margin: 0 }}>Escala do galpão</h2>
        <Link className="botao claro" href="/coop/escala">
          🖨 Folha da equipe
        </Link>
      </div>
      <p className="discreto">A mesma toda semana. A diária fica só no app: não sai na folha da equipe. O custo de montagem da semana nova já vem com o total.</p>
      <div className="grade escala-dias">
        {e.dias.map((d, k) => (
          <div key={k} className="escala-dia">
            <input type="text" value={d.dia} aria-label="Dia" className="escala-titulo" onChange={(ev) => setE({ ...e, dias: e.dias.map((x, j) => (j === k ? { ...x, dia: ev.target.value } : x)) })} />
            {d.pessoas.map((p, i) => (
              <div key={i} className="botoes escala-pessoa">
                <input type="text" value={p.nome} placeholder="nome" aria-label="Nome" onChange={(ev) => mudarPessoa(k, i, { nome: ev.target.value })} style={{ width: 120 }} />
                <select value={p.funcao} aria-label="Função" onChange={(ev) => mudarPessoa(k, i, { funcao: ev.target.value as "chefe" | "ajudante" })}>
                  <option value="chefe">chefe</option>
                  <option value="ajudante">ajudante</option>
                </select>
                <input type="text" value={p.hora} placeholder="9h" aria-label="Chega às" onChange={(ev) => mudarPessoa(k, i, { hora: ev.target.value })} style={{ width: 60 }} />
                <button type="button" className="botao pequeno claro" aria-label="Tirar" onClick={() => setE({ ...e, dias: e.dias.map((x, j) => (j === k ? { ...x, pessoas: x.pessoas.filter((_, z) => z !== i) } : x)) })}>
                  ✕
                </button>
              </div>
            ))}
            <div className="botoes">
              <button type="button" className="botao pequeno claro" onClick={() => setE({ ...e, dias: e.dias.map((x, j) => (j === k ? { ...x, pessoas: [...x.pessoas, { nome: "", funcao: "ajudante", hora: x.pessoas.at(-1)?.hora ?? "" }] } : x)) })}>
                + pessoa
              </button>
              {e.dias.length > 1 && (
                <button type="button" className="botao pequeno claro" onClick={() => setE({ ...e, dias: e.dias.filter((_, j) => j !== k) })}>
                  tirar o dia
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="botoes" style={{ marginTop: 8 }}>
        <button type="button" className="botao pequeno claro" onClick={() => setE({ ...e, dias: [...e.dias, { dia: "", pessoas: [] }] })}>
          + dia
        </button>
      </div>
      <div className="grade" style={{ marginTop: 12 }}>
        <label className="campo">
          Tarefas do chefe (uma por linha)
          <textarea value={tarefas} onChange={(ev) => setTarefas(ev.target.value)} style={{ minHeight: 120 }} />
        </label>
        <div>
          <label className="campo">
            Diária (R$ por pessoa, todos iguais)
            <CampoNumero rotulo="Diária" valor={diaria} aoMudar={setDiaria} largura={120} />
          </label>
          <p className="numero" style={{ marginTop: 10 }}>
            <small>Custo de montagem por semana (só no app)</small>
            <strong>{reais(custoDaEscala(atual))}</strong>
            <span className="discreto">
              {diariasDaEscala(atual)} diárias × {reais(atual.diaria)}
            </span>
          </p>
        </div>
      </div>
      <div className="botoes">
        <button type="button" className="botao" disabled={pendente} onClick={() => rodar(() => salvarEscala(atual), "Escala salva.")}>
          Salvar escala
        </button>
      </div>
      <Aviso aviso={aviso} />
    </div>
  );
}
