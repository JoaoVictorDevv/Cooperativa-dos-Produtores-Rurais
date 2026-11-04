"use client";

import { useMemo, useState } from "react";
import { kg } from "@/lib/coop/numeros";
import { lerRetornos, type MudancaRetorno } from "@/lib/coop/retornos";
import type { Motivo, RetornoEscola } from "@/lib/coop/tipos";
import { marcarRomaneiosConferidos, salvarRetornos } from "../../../acoes";
import { Aviso, CampoNumero, lerNumero, mostrarNumero, useAcao } from "../../../ui";

interface Item {
  produto: string;
  pedido: number;
  enviado: number;
  retorno: RetornoEscola | null;
  aceito: number;
  falta: number;
}
interface EscolaRetorno {
  codigo: string;
  nome: string;
  nomeMapa: string;
  parada: string;
  itens: Item[];
}
export interface RotaRetorno {
  id: string;
  titulo: string;
  escolas: EscolaRetorno[];
}

export function Retornos({ data, rotas, produtos, motivos, conferidos }: { data: string; rotas: RotaRetorno[]; produtos: string[]; motivos: Motivo[]; conferidos: boolean }) {
  const [aberta, setAberta] = useState<string | null>(null);
  const conferir = useAcao();
  const todas = useMemo(() => rotas.flatMap((r) => r.escolas), [rotas]);
  const comProblema = todas.filter((e) => e.itens.some((i) => i.retorno)).length;
  return (
    <>
      <Atalho data={data} escolas={todas} produtos={produtos} />
      <div className="card botoes" style={{ justifyContent: "space-between" }}>
        <span>
          {comProblema} escola(s) com diferença. O resto conta como recebeu o que saiu no caminhão.
        </span>
        <span className="botoes">
          {conferidos ? <span className="etiqueta verde">romaneios conferidos</span> : <span className="etiqueta amarela">ainda conferindo</span>}
          <button
            type="button"
            className={conferidos ? "botao claro pequeno" : "botao pequeno"}
            disabled={conferir.pendente}
            onClick={() => conferir.rodar(() => marcarRomaneiosConferidos(data, !conferidos), conferidos ? "Voltou para conferindo." : "Pronto: romaneios conferidos.")}
          >
            {conferidos ? "Reabrir" : "Terminei: todos os romaneios conferidos"}
          </button>
        </span>
      </div>
      <Aviso aviso={conferir.aviso} />
      {rotas.map((ro) => (
        <section key={ro.id}>
          <div className="rota-titulo botoes" style={{ justifyContent: "space-between" }}>
            <span>{ro.titulo}</span>
            <RotaNaoEntregue data={data} rota={ro} />
          </div>
          <div className="rota-corpo rolar">
            <table className="tabela">
              <tbody>
                {ro.escolas.map((e) => {
                  const problemas = e.itens.filter((i) => i.retorno);
                  const aberto = aberta === `${ro.id}|${e.codigo}`;
                  return (
                    <FragmentoEscola
                      key={e.codigo}
                      data={data}
                      e={e}
                      problemas={problemas}
                      aberto={aberto}
                      alternar={() => setAberta(aberto ? null : `${ro.id}|${e.codigo}`)}
                      motivos={motivos}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </>
  );
}

function resumoRetorno(i: Item): string {
  const r = i.retorno;
  if (!r) return "";
  const partes: string[] = [];
  if (r.recebido !== undefined) partes.push(r.recebido === 0 ? "não chegou" : `chegou ${kg(r.recebido)}`);
  if (r.rejeitado) partes.push(`recusou ${kg(r.rejeitado)}`);
  return `${i.produto}: ${partes.join(", ")}`;
}

function FragmentoEscola({
  data,
  e,
  problemas,
  aberto,
  alternar,
  motivos,
}: {
  data: string;
  e: EscolaRetorno;
  problemas: Item[];
  aberto: boolean;
  alternar: () => void;
  motivos: Motivo[];
}) {
  return (
    <>
      <tr className="escola-linha" onClick={alternar}>
        <td style={{ width: 44 }}>{e.parada}</td>
        <td style={{ width: 70 }}>{e.codigo}</td>
        <td>
          <strong>{e.nomeMapa}</strong>
        </td>
        <td>{problemas.length ? <span className="etiqueta vermelha">{problemas.map(resumoRetorno).join(" · ")}</span> : <span className="etiqueta verde">ok</span>}</td>
        <td className="direita">{aberto ? "▲" : "▼"}</td>
      </tr>
      {aberto && (
        <tr>
          <td colSpan={5} style={{ background: "#fbfbf7" }}>
            <EditorEscola data={data} e={e} motivos={motivos} />
          </td>
        </tr>
      )}
    </>
  );
}

type Campos = { recebido: string; rejeitado: string; motivo: string; situacao: string };

function EditorEscola({ data, e, motivos }: { data: string; e: EscolaRetorno; motivos: Motivo[] }) {
  const [v, setV] = useState<Record<string, Campos>>(() =>
    Object.fromEntries(
      e.itens.map((i) => [
        i.produto,
        { recebido: mostrarNumero(i.retorno?.recebido), rejeitado: mostrarNumero(i.retorno?.rejeitado), motivo: i.retorno?.motivo ?? "", situacao: i.retorno?.situacao ?? "" },
      ]),
    ),
  );
  const { pendente, aviso, rodar } = useAcao();
  const erros = e.itens.flatMap((i) => {
    const rec = lerNumero(v[i.produto].recebido);
    const rej = lerNumero(v[i.produto].rejeitado);
    if (Number.isNaN(rec) || Number.isNaN(rej)) return [`${i.produto}: número inválido`];
    if (rec !== null && rec > i.pedido + 0.0001) return [`${i.produto}: recebido maior que o pedido (${kg(i.pedido)})`];
    if (rej !== null && rej > (rec ?? i.enviado) + 0.0001) return [`${i.produto}: recusado maior que o que chegou`];
    return [];
  });

  function salvar(tudoOk = false) {
    const saida: Record<string, RetornoEscola | null> = {};
    for (const i of e.itens) {
      const c = v[i.produto];
      const rec = lerNumero(c.recebido);
      const rej = lerNumero(c.rejeitado);
      const r: RetornoEscola = {};
      if (!tudoOk) {
        if (rec !== null) r.recebido = rec;
        if (rej !== null && rej > 0) r.rejeitado = rej;
        if (c.motivo) r.motivo = c.motivo;
        if (c.situacao) r.situacao = c.situacao;
      }
      saida[i.produto] = Object.keys(r).length ? r : null;
    }
    rodar(() => salvarRetornos(data, { [e.codigo]: saida }), tudoOk ? "Tudo certo nesta escola." : "Salvo.");
    if (tudoOk) setV(Object.fromEntries(e.itens.map((i) => [i.produto, { recebido: "", rejeitado: "", motivo: "", situacao: "" }])));
  }

  return (
    <>
      <p className="discreto" style={{ margin: "0 0 6px" }}>
        {e.nome}. Em branco = chegou o que saiu no caminhão.
      </p>
      <table className="tabela">
        <thead>
          <tr>
            <th>Produto</th>
            <th className="n">Pedido</th>
            <th className="n">Saiu no caminhão</th>
            <th className="n">Chegou (kg)</th>
            <th className="n">Recusou (kg)</th>
            <th>Motivo</th>
            <th>Situação da falta</th>
            <th className="n">Aceito</th>
          </tr>
        </thead>
        <tbody>
          {e.itens.map((i) => {
            const c = v[i.produto];
            const set = (k: keyof Campos) => (t: string) => setV({ ...v, [i.produto]: { ...c, [k]: t } });
            return (
              <tr key={i.produto}>
                <td>{i.produto}</td>
                <td className="n">{kg(i.pedido)}</td>
                <td className="n">{kg(i.enviado)}</td>
                <td className="n">
                  <CampoNumero rotulo={`Chegou ${i.produto}`} valor={c.recebido} aoMudar={set("recebido")} placeholder={mostrarNumero(i.enviado)} largura={80} />
                </td>
                <td className="n">
                  <CampoNumero rotulo={`Recusou ${i.produto}`} valor={c.rejeitado} aoMudar={set("rejeitado")} largura={80} />
                </td>
                <td>
                  <select value={c.motivo} onChange={(ev) => set("motivo")(ev.target.value)} aria-label={`Motivo ${i.produto}`}>
                    <option value="">—</option>
                    {motivos.map((m) => (
                      <option key={m.codigo} value={m.codigo}>
                        {m.codigo} - {m.texto}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <select value={c.situacao} onChange={(ev) => set("situacao")(ev.target.value)} aria-label={`Situação ${i.produto}`}>
                    <option value="">—</option>
                    <option value="Encerrada sem atendimento">Encerrada sem atendimento</option>
                  </select>
                </td>
                <td className="n">{kg(i.aceito)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {erros.length > 0 && <p className="erro">{erros.join("; ")}</p>}
      <div className="botoes" style={{ marginTop: 8 }}>
        <button type="button" className="botao pequeno" disabled={pendente || erros.length > 0} onClick={() => salvar()}>
          {pendente ? "Salvando…" : "Salvar escola"}
        </button>
        <button type="button" className="botao claro pequeno" disabled={pendente} onClick={() => salvar(true)}>
          Tudo certo (limpar)
        </button>
      </div>
      <Aviso aviso={aviso} />
    </>
  );
}

function RotaNaoEntregue({ data, rota }: { data: string; rota: RotaRetorno }) {
  const [certeza, setCerteza] = useState(false);
  const { pendente, aviso, rodar } = useAcao();
  function aplicar() {
    const saida: Record<string, Record<string, RetornoEscola | null>> = {};
    for (const e of rota.escolas) saida[e.codigo] = Object.fromEntries(e.itens.filter((i) => i.enviado > 0.0001).map((i) => [i.produto, { recebido: 0 }]));
    rodar(() => salvarRetornos(data, saida), "Rota marcada como não entregue.");
    setCerteza(false);
  }
  return (
    <span className="botoes">
      {certeza ? (
        <>
          <span style={{ fontWeight: 400 }}>Nenhuma escola desta rota recebeu?</span>
          <button type="button" className="botao pequeno perigo" disabled={pendente} onClick={aplicar}>
            Sim, marcar
          </button>
          <button type="button" className="botao pequeno claro" onClick={() => setCerteza(false)}>
            Não
          </button>
        </>
      ) : (
        <button type="button" className="botao pequeno claro" onClick={() => setCerteza(true)}>
          Rota não entregue
        </button>
      )}
      {aviso?.tipo === "erro" && <Aviso aviso={aviso} />}
    </span>
  );
}

function Atalho({ data, escolas, produtos }: { data: string; escolas: EscolaRetorno[]; produtos: string[] }) {
  const [texto, setTexto] = useState("");
  const [lido, setLido] = useState<{ mudancas: MudancaRetorno[]; naoEntendi: string[] } | null>(null);
  const { pendente, aviso, rodar } = useAcao();
  const mapa = useMemo(() => new Map(escolas.map((e) => [e.codigo, e])), [escolas]);
  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Atalho: escreva o que deu diferente</h3>
      <p className="discreto" style={{ marginTop: 0 }}>
        Uma linha por escola, começando pelo código. Ex.: <code>1005 não veio cheiro verde</code> · <code>1021 recusou alface 2kg</code> · <code>2018 alface veio 1,5</code> ·{" "}
        <code>1081 não recebeu nada</code>
      </p>
      <textarea value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="1005 não veio cheiro verde" />
      <div className="botoes" style={{ marginTop: 8 }}>
        <button
          type="button"
          className="botao claro"
          onClick={() =>
            setLido(
              lerRetornos(
                texto,
                escolas.map((e) => ({ codigo: e.codigo, nome: e.nomeMapa })),
                produtos,
                (c, p) => mapa.get(c)?.itens.find((i) => i.produto === p)?.enviado ?? 0,
              ),
            )
          }
        >
          Ver o que entendi
        </button>
      </div>
      {lido && (
        <>
          {lido.mudancas.length > 0 && (
            <ul>
              {lido.mudancas.map((m, k) => (
                <li key={k}>{m.explicacao}</li>
              ))}
            </ul>
          )}
          {lido.naoEntendi.length > 0 && <p className="aviso">Não entendi: {lido.naoEntendi.join(" | ")}</p>}
          {lido.mudancas.length > 0 && (
            <button
              type="button"
              className="botao"
              disabled={pendente}
              onClick={() => {
                const saida: Record<string, Record<string, RetornoEscola>> = {};
                for (const m of lido.mudancas) {
                  const atual = mapa.get(m.codigo)?.itens.find((i) => i.produto === m.produto)?.retorno ?? {};
                  (saida[m.codigo] ??= {})[m.produto] = { ...atual, ...(saida[m.codigo]?.[m.produto] ?? {}), ...m.retorno };
                }
                rodar(() => salvarRetornos(data, saida), "Retornos gravados.", () => {
                  setTexto("");
                  setLido(null);
                });
              }}
            >
              Gravar {lido.mudancas.length} mudança(s)
            </button>
          )}
        </>
      )}
      <Aviso aviso={aviso} />
    </div>
  );
}
