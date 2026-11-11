"use client";

import { useMemo, useState } from "react";
import { kg } from "@/lib/coop/numeros";
import { lerRetornos, type MudancaRetorno } from "@/lib/coop/retornos";
import type { Motivo, Reentrega, RetornoEscola } from "@/lib/coop/tipos";
import { marcarRomaneiosConferidos, salvarReentrega, salvarRetornos } from "../../../acoes";
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
  rotaId: string;
  reentrega: Reentrega | null;
  itens: Item[];
}
export interface RotaRetorno {
  id: string;
  titulo: string;
  escolas: EscolaRetorno[];
}

export function Retornos({ data, rotas, produtos, motivos, conferidos }: { data: string; rotas: RotaRetorno[]; produtos: string[]; motivos: Motivo[]; conferidos: boolean }) {
  const [aberta, setAberta] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const conferir = useAcao();
  const todas = useMemo(() => rotas.flatMap((r) => r.escolas), [rotas]);
  const comProblema = todas.filter((e) => e.itens.some((i) => i.retorno)).length;
  const reentregas = todas.filter((e) => e.reentrega && !e.reentrega.feita);
  const semAcento = (t: string) => t.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const achadas = busca.trim().length >= 2 ? todas.filter((e) => e.codigo.startsWith(busca.trim()) || semAcento(e.nome).includes(semAcento(busca)) || semAcento(e.nomeMapa).includes(semAcento(busca))).slice(0, 8) : [];
  const rotasCurtas = rotas.map((r) => ({ id: r.id, nome: r.titulo.split(" — ")[1]?.split(" · ").slice(0, 2).join(" · ") ?? r.id }));
  return (
    <>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Escolher a escola</h3>
        <input type="text" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Código ou nome da escola…" style={{ width: "100%", maxWidth: 420 }} aria-label="Procurar escola" />
        {achadas.length > 0 && (
          <div className="botoes" style={{ marginTop: 8 }}>
            {achadas.map((e) => (
              <button
                key={e.codigo}
                type="button"
                className="botao pequeno claro"
                onClick={() => {
                  setAberta(`${e.rotaId}|${e.codigo}`);
                  setBusca("");
                  setTimeout(() => document.getElementById(`escola-${e.codigo}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
                }}
              >
                {e.codigo} · {e.nomeMapa}
              </button>
            ))}
          </div>
        )}
        {busca.trim().length >= 2 && achadas.length === 0 && <p className="discreto">Nenhuma escola com pedido nesta semana bate com “{busca}”.</p>}
      </div>
      {reentregas.length > 0 && (
        <p className="aviso">
          <strong>Reentregas pendentes:</strong>{" "}
          {reentregas.map((e) => `${e.nomeMapa} (${e.reentrega!.motivo.toLowerCase()} → ${e.reentrega!.dia === "OUTRO" ? e.reentrega!.quando || "outro dia" : e.reentrega!.dia === "SEG" ? "segunda" : "terça"}, ${rotasCurtas.find((r) => r.id === e.reentrega!.rota)?.nome ?? e.reentrega!.rota})`).join("; ")}.
          Elas aparecem no mapa do dia escolhido com o mesmo romaneio.
        </p>
      )}
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
                      rotas={rotasCurtas}
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
  rotas,
}: {
  data: string;
  e: EscolaRetorno;
  problemas: Item[];
  aberto: boolean;
  alternar: () => void;
  motivos: Motivo[];
  rotas: { id: string; nome: string }[];
}) {
  return (
    <>
      <tr className="escola-linha" onClick={alternar} id={`escola-${e.codigo}`}>
        <td style={{ width: 44 }}>{e.parada}</td>
        <td style={{ width: 70 }}>{e.codigo}</td>
        <td>
          <strong>{e.nomeMapa}</strong>
        </td>
        <td>
          {problemas.length ? <span className="etiqueta vermelha">{problemas.map(resumoRetorno).join(" · ")}</span> : !e.reentrega ? <span className="etiqueta verde">ok</span> : null}{" "}
          {e.reentrega && <span className={`etiqueta ${e.reentrega.feita ? "verde" : "amarela"}`}>{e.reentrega.feita ? "reentregue" : `reentrega: ${e.reentrega.motivo.toLowerCase()}`}</span>}
        </td>
        <td className="direita">{aberto ? "▲" : "▼"}</td>
      </tr>
      {aberto && (
        <tr>
          <td colSpan={5} style={{ background: "#fbfbf7" }}>
            <EditorEscola data={data} e={e} motivos={motivos} />
            <ReentregaEscola data={data} e={e} rotas={rotas} />
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

// Escola fechada no dia: volta e vai outro dia, por outra rota ou pela moto, com o mesmo romaneio.
function ReentregaEscola({ data, e, rotas }: { data: string; e: EscolaRetorno; rotas: { id: string; nome: string }[] }) {
  const atual = e.reentrega;
  const [aberto, setAberto] = useState(Boolean(atual));
  const [re, setRe] = useState<Reentrega>(atual ?? { motivo: "Escola fechada", dia: e.rotaId.startsWith("SEG") ? "TER" : "SEG", rota: "", quando: "", feita: false });
  const { pendente, aviso, rodar } = useAcao();
  if (!aberto)
    return (
      <div className="botoes" style={{ marginTop: 10 }}>
        <button type="button" className="botao claro pequeno" onClick={() => setAberto(true)}>
          Escola fechada / não recebeu → marcar reentrega
        </button>
      </div>
    );
  const rotasDoDia = rotas.filter((r) => (re.dia === "OUTRO" ? true : r.id.startsWith(re.dia)));
  return (
    <div style={{ marginTop: 12, padding: 10, border: "1px dashed var(--c-amarelo-borda)", borderRadius: 10, background: "var(--c-amarelo)" }}>
      <strong>Reentrega</strong> <span className="discreto">— a escola recebe depois, com o mesmo romaneio; a semana não muda.</span>
      <div className="botoes" style={{ marginTop: 8, alignItems: "flex-end" }}>
        <label className="campo">
          Motivo
          <select value={re.motivo} onChange={(ev) => setRe({ ...re, motivo: ev.target.value })}>
            <option>Escola fechada</option>
            <option>Ninguém para receber</option>
            <option>Caminhão não passou</option>
            <option>Outro</option>
          </select>
        </label>
        <label className="campo">
          Vai de novo
          <select value={re.dia} onChange={(ev) => setRe({ ...re, dia: ev.target.value as Reentrega["dia"], rota: "" })}>
            <option value="SEG">segunda (rotas de segunda)</option>
            <option value="TER">terça (rotas de terça)</option>
            <option value="OUTRO">outro dia</option>
          </select>
        </label>
        <label className="campo">
          Por qual rota
          <select value={re.rota} onChange={(ev) => setRe({ ...re, rota: ev.target.value })}>
            <option value="">— escolher —</option>
            {rotasDoDia.map((r) => (
              <option key={r.id} value={r.id}>
                {r.id.endsWith("MOTOBOY") ? "Motoboy" : r.nome}
              </option>
            ))}
            <option value="MOTO">Moto (avulso)</option>
            <option value="CARRO">Carro da cooperativa</option>
          </select>
        </label>
        <label className="campo">
          Quando / observação
          <input type="text" value={re.quando ?? ""} onChange={(ev) => setRe({ ...re, quando: ev.target.value })} placeholder="ex.: quarta 12/11 de manhã" style={{ width: 200 }} />
        </label>
        <label className="discreto">
          <input type="checkbox" checked={re.feita} onChange={(ev) => setRe({ ...re, feita: ev.target.checked })} /> já foi entregue
        </label>
      </div>
      <div className="botoes" style={{ marginTop: 8 }}>
        <button type="button" className="botao pequeno" disabled={pendente || !re.rota} onClick={() => rodar(() => salvarReentrega(data, e.codigo, re), "Reentrega marcada.")}>
          {pendente ? "Salvando…" : "Salvar reentrega"}
        </button>
        {atual && (
          <button type="button" className="botao pequeno perigo" disabled={pendente} onClick={() => rodar(() => salvarReentrega(data, e.codigo, null), "Reentrega tirada.", () => setAberto(false))}>
            Tirar reentrega
          </button>
        )}
        {!atual && (
          <button type="button" className="botao pequeno claro" onClick={() => setAberto(false)}>
            Cancelar
          </button>
        )}
      </div>
      <Aviso aviso={aviso} />
    </div>
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
