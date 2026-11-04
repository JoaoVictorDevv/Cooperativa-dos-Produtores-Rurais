"use client";

import { useMemo, useState } from "react";
import { linkWhatsApp, perguntaPrevisao } from "@/lib/coop/mensagens";
import { kg } from "@/lib/coop/numeros";
import { entenderResposta, type Previsao } from "@/lib/coop/previsao";
import { salvarPrevisao } from "../acoes";
import { Aviso, BotaoImprimir, CampoNumero, lerNumero, mostrarNumero, useAcao } from "../ui";

interface Prod {
  id: string;
  nome: string;
  curto: string;
  telefone: string | null;
}

type Estado = Record<string, { resposta: string; sem: boolean; itens: { produto: string; kg: string }[] }>;

const NOME_DIA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const dd = (d: Date) => `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

export function PrevisaoTela({ data, produtores, produtos, inicial }: { data: string; produtores: Prod[]; produtos: string[]; inicial: Previsao | null }) {
  const ref = new Date(`${data}T12:00:00Z`);
  const ontem = new Date(ref.getTime() - 86400000);
  const quarta = new Date(ref.getTime() - 5 * 86400000);
  const [dias, setDias] = useState(`${NOME_DIA[ontem.getUTCDay()]} ${dd(ontem)} e ${NOME_DIA[ref.getUTCDay()]} ${dd(ref)}`);
  const [prazo, setPrazo] = useState(`${NOME_DIA[quarta.getUTCDay()]} ${dd(quarta)}`);
  const [obs, setObs] = useState((inicial?.observacoes ?? []).join("\n"));
  const [e, setE] = useState<Estado>(() =>
    Object.fromEntries(
      produtores.map((p) => [
        p.id,
        {
          resposta: inicial?.respostas[p.id] ?? "",
          sem: inicial?.semProducao.includes(p.id) ?? false,
          itens: (inicial?.itens ?? []).filter((i) => i.produtor === p.id).map((i) => ({ produto: i.produto, kg: mostrarNumero(i.kg) })),
        },
      ]),
    ),
  );
  const { pendente, aviso, rodar } = useAcao();

  const itens = useMemo(
    () =>
      produtores.flatMap((p) =>
        e[p.id].sem
          ? []
          : e[p.id].itens.map((i) => ({ produtor: p.id, produto: i.produto, kg: lerNumero(i.kg) ?? 0 })).filter((i) => !Number.isNaN(i.kg) && i.kg > 0),
      ),
    [e, produtores],
  );
  const responderam = produtores.filter((p) => e[p.id].sem || e[p.id].itens.length > 0 || e[p.id].resposta.trim());
  const faltam = produtores.filter((p) => !responderam.includes(p));
  const porProduto = produtos
    .map((pr) => ({ produto: pr, total: itens.filter((i) => i.produto === pr).reduce((s, i) => s + i.kg, 0), quem: itens.filter((i) => i.produto === pr) }))
    .filter((x) => x.total > 0);
  const total = porProduto.reduce((s, x) => s + x.total, 0);
  const curto = new Map(produtores.map((p) => [p.id, p.curto]));
  const dataBr = data.split("-").reverse().join("/");

  function salvar() {
    rodar(
      () =>
        salvarPrevisao({
          data,
          itens,
          semProducao: produtores.filter((p) => e[p.id].sem).map((p) => p.id),
          observacoes: obs.split("\n").map((t) => t.trim()).filter(Boolean),
          respostas: Object.fromEntries(produtores.filter((p) => e[p.id].resposta.trim()).map((p) => [p.id, e[p.id].resposta])),
        }),
      "Previsão gravada.",
    );
  }

  return (
    <>
      <div className="card nao-imprimir">
        <h2 style={{ marginTop: 0 }}>1. Perguntar</h2>
        <div className="botoes" style={{ alignItems: "flex-end" }}>
          <label className="campo">
            Dias no galpão
            <input type="text" value={dias} onChange={(ev) => setDias(ev.target.value)} style={{ width: 260 }} />
          </label>
          <label className="campo">
            Prazo da nutrição
            <input type="text" value={prazo} onChange={(ev) => setPrazo(ev.target.value)} style={{ width: 160 }} />
          </label>
        </div>
        <p className="discreto">Texto: “{perguntaPrevisao({ curto: "Fulano" }, dataBr.slice(0, 5), dias, prazo)}”</p>
        <div className="botoes">
          {produtores.map((p) => {
            const link = linkWhatsApp(p.telefone, perguntaPrevisao(p, dataBr.slice(0, 5), dias, prazo));
            const ok = responderam.includes(p);
            return link ? (
              <a key={p.id} className={`botao pequeno ${ok ? "claro" : "zap"}`} href={link} target="_blank" rel="noreferrer">
                {ok ? "✓ " : ""}
                {p.curto}
              </a>
            ) : (
              <span key={p.id} className="etiqueta vermelha">
                {p.curto}: sem telefone
              </span>
            );
          })}
        </div>
      </div>

      <div className="card nao-imprimir">
        <h2 style={{ marginTop: 0 }}>2. Colar as respostas</h2>
        <p className="discreto" style={{ marginTop: 0 }}>
          Cole a mensagem do produtor como veio (ex.: “2mil kg xuxu”, “30kl couve 75kl alface”). O app mostra o que entendeu; corrija no amarelo se precisar.
        </p>
        <div className="grade" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
          {produtores.map((p) => {
            const x = e[p.id];
            const set = (novo: Partial<Estado[string]>) => setE({ ...e, [p.id]: { ...x, ...novo } });
            return (
              <div key={p.id} className="numero">
                <div className="botoes" style={{ justifyContent: "space-between" }}>
                  <strong style={{ fontSize: 15 }}>{p.nome}</strong>
                  <label className="discreto">
                    <input type="checkbox" checked={x.sem} onChange={(ev) => set({ sem: ev.target.checked })} /> não vai ter
                  </label>
                </div>
                <textarea
                  value={x.resposta}
                  placeholder="Cole aqui a resposta…"
                  style={{ minHeight: 60, marginTop: 6 }}
                  onChange={(ev) => {
                    const t = ev.target.value;
                    const lidos = entenderResposta(t, produtos);
                    set({ resposta: t, itens: lidos.map((l) => ({ produto: l.produto, kg: mostrarNumero(l.kg) })) });
                  }}
                />
                {!x.sem &&
                  x.itens.map((i, k) => (
                    <div key={k} className="botoes" style={{ marginTop: 4 }}>
                      <select
                        value={i.produto}
                        aria-label="Produto"
                        onChange={(ev) => set({ itens: x.itens.map((y, j) => (j === k ? { ...y, produto: ev.target.value } : y)) })}
                      >
                        {produtos.map((pr) => (
                          <option key={pr}>{pr}</option>
                        ))}
                      </select>
                      <CampoNumero rotulo={`kg ${i.produto}`} valor={i.kg} aoMudar={(t) => set({ itens: x.itens.map((y, j) => (j === k ? { ...y, kg: t } : y)) })} />
                      <button type="button" className="botao pequeno claro" onClick={() => set({ itens: x.itens.filter((_, j) => j !== k) })} aria-label="Tirar">
                        ✕
                      </button>
                    </div>
                  ))}
                {!x.sem && (
                  <button type="button" className="botao pequeno claro" style={{ marginTop: 6 }} onClick={() => set({ itens: [...x.itens, { produto: produtos[0], kg: "" }] })}>
                    + produto
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <label className="campo" style={{ marginTop: 12 }}>
          Observações para a nutricionista (uma por linha)
          <textarea value={obs} onChange={(ev) => setObs(ev.target.value)} style={{ minHeight: 60 }} />
        </label>
        <div className="botoes" style={{ marginTop: 10 }}>
          <button type="button" className="botao" disabled={pendente} onClick={salvar}>
            {pendente ? "Gravando…" : "Gravar previsão"}
          </button>
          <BotaoImprimir texto="Imprimir / PDF para a nutricionista" />
        </div>
        <Aviso aviso={aviso} />
      </div>

      <div className="folha">
        <h3>Previsão de produção — entrega {dataBr}</h3>
        <p className="linha-cab">Cooperativa · quantidades informadas pelos produtores (kg)</p>
        <table>
          <thead>
            <tr>
              <th>PRODUTO</th>
              <th className="n">TOTAL (kg)</th>
              <th>PRODUTORES</th>
            </tr>
          </thead>
          <tbody>
            {porProduto.map((x) => (
              <tr key={x.produto}>
                <td>{x.produto}</td>
                <td className="n">
                  <strong>{kg(x.total)}</strong>
                </td>
                <td>{x.quem.map((q) => `${curto.get(q.produtor)} ${kg(q.kg)}`).join(" · ")}</td>
              </tr>
            ))}
            <tr>
              <td>
                <strong>TOTAL</strong>
              </td>
              <td className="n">
                <strong>{kg(total)}</strong>
              </td>
              <td />
            </tr>
          </tbody>
        </table>
        {obs.trim() && (
          <div className="assina">
            <strong>Observações:</strong>
            <ul>
              {obs
                .split("\n")
                .filter((t) => t.trim())
                .map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
            </ul>
          </div>
        )}
        <p className="linha-cab nao-imprimir" style={{ marginTop: 10 }}>
          {faltam.length ? (
            <span className="etiqueta amarela">Ainda não responderam: {faltam.map((p) => p.curto).join(", ")}</span>
          ) : (
            <span className="etiqueta verde">Todos responderam</span>
          )}
        </p>
      </div>
    </>
  );
}
