"use client";

import { useMemo, useState } from "react";
import { linkWhatsApp, perguntaPrevisao } from "@/lib/coop/mensagens";
import { kg } from "@/lib/coop/numeros";
import { entenderResposta, lerDocumentoPrevisao, type DocumentoLido, type Previsao } from "@/lib/coop/previsao";
import { lerAnexoPrevisao, salvarPrevisao } from "../acoes";
import { Aviso, BotaoImprimir, CampoNumero, lerNumero, marcarSujo, mostrarNumero, useAcao } from "../ui";

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
  // Dias do galpão: domingo e segunda da entrega (a data pode ser o domingo ou a segunda).
  const ref = new Date(`${data}T12:00:00Z`);
  const dia = (d: number) => new Date(ref.getTime() + d * 86400000);
  const domingo = ref.getUTCDay() === 0 ? ref : dia(-((ref.getUTCDay() + 7) % 7));
  const segunda = new Date(domingo.getTime() + 86400000);
  const [dias, setDias] = useState(`${NOME_DIA[domingo.getUTCDay()]} ${dd(domingo)} e ${NOME_DIA[segunda.getUTCDay()]} ${dd(segunda)}`);
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
        <h2 style={{ marginTop: 0 }}>1. Perguntar (mensagem separada, depois da entrega)</h2>
        <div className="botoes" style={{ alignItems: "flex-end" }}>
          <label className="campo">
            Dias no galpão
            <input data-livre type="text" value={dias} onChange={(ev) => setDias(ev.target.value)} style={{ width: 260 }} />
          </label>
        </div>
        <p className="discreto">Texto: “{perguntaPrevisao({ curto: "Fulano" }, dataBr.slice(0, 5), dias)}”</p>
        <div className="botoes">
          {produtores.map((p) => {
            const link = linkWhatsApp(p.telefone, perguntaPrevisao(p, dataBr.slice(0, 5), dias));
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

      <Anexo
        produtores={produtores}
        produtos={produtos}
        aoPreencher={(doc, obsEscolhidas) => {
          const novo = { ...e };
          for (const [id, itensLidos] of Object.entries(doc.porProdutor)) {
            if (!novo[id]) continue;
            novo[id] = { ...novo[id], sem: false, itens: itensLidos.map((l) => ({ produto: l.produto, kg: mostrarNumero(l.kg) })) };
          }
          setE(novo);
          if (obsEscolhidas.length) setObs([...obs.split("\n").map((t) => t.trim()).filter(Boolean), ...obsEscolhidas.filter((o) => !obs.includes(o))].join("\n"));
        }}
      />

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
                    <input type="checkbox" checked={x.sem} onChange={(ev) => set({ sem: ev.target.checked })} /> Não vai ter
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
                    + Produto
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
        <h3 style={{ fontSize: 20, color: "var(--c-verde)" }}>Previsão — entrega de {dataBr.slice(0, 5)}</h3>
        <p className="linha-cab" style={{ color: "#555" }}>O que cada produtor disse que vai ter (kg).</p>
        <h3 style={{ marginTop: 14, color: "var(--c-verde)" }}>Total por produto</h3>
        <table style={{ maxWidth: 420 }}>
          <thead>
            <tr>
              <th>PRODUTO</th>
              <th className="n">QUANTIDADE</th>
            </tr>
          </thead>
          <tbody>
            {porProduto.map((x) => (
              <tr key={x.produto}>
                <td>{x.produto}</td>
                <td className="n">
                  <strong>{kg(x.total)} kg</strong>
                </td>
              </tr>
            ))}
            <tr>
              <td>
                <strong>TOTAL</strong>
              </td>
              <td className="n">
                <strong>{kg(total)} kg</strong>
              </td>
            </tr>
          </tbody>
        </table>
        <h3 style={{ marginTop: 18, color: "var(--c-verde)" }}>Por produtor</h3>
        <table style={{ maxWidth: 560 }}>
          <thead>
            <tr>
              <th>PRODUTOR</th>
              <th>PRODUTO</th>
              <th className="n">QUANTIDADE</th>
            </tr>
          </thead>
          <tbody>
            {produtores.flatMap((pr) =>
              itens
                .filter((it) => it.produtor === pr.id)
                .map((it, k) => (
                  <tr key={`${pr.id}-${it.produto}`}>
                    <td>{k === 0 ? pr.curto : ""}</td>
                    <td>{it.produto}</td>
                    <td className="n">{kg(it.kg)} kg</td>
                  </tr>
                )),
            )}
          </tbody>
        </table>
        {obs.trim() && (
          <div className="assina" style={{ fontStyle: "italic" }}>
            <ul style={{ paddingLeft: 0, listStyle: "none" }}>
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

// Anexar um documento (conversa exportada do WhatsApp, planilha, Word) ou colar tudo de uma vez.
function Anexo({ produtores, produtos, aoPreencher }: { produtores: Prod[]; produtos: string[]; aoPreencher: (doc: DocumentoLido, obs: string[]) => void }) {
  const [texto, setTexto] = useState("");
  const [lido, setLido] = useState<DocumentoLido | null>(null);
  const [obsMarcadas, setObsMarcadas] = useState<string[]>([]);
  const { pendente, aviso, setAviso, rodar } = useAcao();
  const nome = new Map(produtores.map((p) => [p.id, p.nome]));
  function entender(t: string) {
    const doc = lerDocumentoPrevisao(t, produtores, produtos);
    setLido(doc);
    setObsMarcadas(doc.observacoes.filter((o) => !/^o que cada produtor/i.test(o)));
    if (!Object.keys(doc.porProdutor).length) setAviso({ tipo: "erro", texto: "Não achei nenhum produtor com quantidade. Confira o texto ou cole a resposta de cada um embaixo." });
  }
  const totalKg = lido ? Object.values(lido.porProdutor).flat().reduce((s, i) => s + i.kg, 0) : 0;
  return (
    <div className="card nao-imprimir" data-livre>
      <h2 style={{ marginTop: 0 }}>Já tem tudo num documento? Anexe ou cole aqui</h2>
      <p className="discreto" style={{ marginTop: 0 }}>
        Serve a conversa exportada do WhatsApp (.txt), a tabela da previsão (.xlsx, .docx ou .csv) ou o texto copiado. O app separa por produtor e mostra antes de
        preencher. PDF ou foto: abra, copie o texto e cole.
      </p>
      <div className="botoes">
        <input
          type="file"
          accept=".txt,.csv,.xlsx,.docx"
          aria-label="Anexar documento da previsão"
          onChange={(ev) => {
            const f = ev.target.files?.[0];
            if (!f) return;
            const form = new FormData();
            form.set("arquivo", f);
            rodar(() => lerAnexoPrevisao(form), "Arquivo lido. Confira embaixo.", (r) => {
              if (r.ok) {
                setTexto(r.texto);
                entender(r.texto);
              }
            });
          }}
        />
      </div>
      <textarea value={texto} onChange={(ev) => setTexto(ev.target.value)} placeholder={"ou cole aqui, ex.:\nAna  Couve manteiga  150 kg\nAlface lisa  200 kg\nGustavo  Chuchu  1.400 kg"} style={{ minHeight: 90, marginTop: 8 }} />
      <div className="botoes" style={{ marginTop: 8 }}>
        <button type="button" className="botao claro" disabled={!texto.trim()} onClick={() => entender(texto)}>
          Ler o texto
        </button>
      </div>
      <Aviso aviso={aviso} />
      {lido && Object.keys(lido.porProdutor).length > 0 && (
        <div style={{ marginTop: 10 }}>
          <p>
            <strong>Entendi {Object.keys(lido.porProdutor).length} produtores, {kg(totalKg)} kg no total:</strong>
          </p>
          <ul className="lista-lida">
            {Object.entries(lido.porProdutor).map(([id, itens]) => (
              <li key={id}>
                <strong>{nome.get(id)}</strong>: {itens.map((i) => `${i.produto} ${kg(i.kg)} kg`).join(" · ")}
              </li>
            ))}
          </ul>
          {lido.observacoes.length > 0 && (
            <>
              <p style={{ marginBottom: 4 }}>
                <strong>Linhas que parecem observação</strong> (marque as que vão para a nutricionista):
              </p>
              {lido.observacoes.map((o) => (
                <label key={o} className="discreto" style={{ display: "block" }}>
                  <input type="checkbox" checked={obsMarcadas.includes(o)} onChange={(ev) => setObsMarcadas(ev.target.checked ? [...obsMarcadas, o] : obsMarcadas.filter((x) => x !== o))} /> {o}
                </label>
              ))}
            </>
          )}
          <div className="botoes" style={{ marginTop: 10 }}>
            <button
              type="button"
              className="botao"
              disabled={pendente}
              onClick={() => {
                aoPreencher(lido, obsMarcadas);
                marcarSujo(true); // ainda não gravou
                setAviso({ tipo: "ok", texto: "Preenchido! Confira cada produtor embaixo e clique em Gravar previsão." });
              }}
            >
              Preencher a previsão com isso
            </button>
            <span className="discreto">Produtor que não está no documento fica como está.</span>
          </div>
        </div>
      )}
    </div>
  );
}
