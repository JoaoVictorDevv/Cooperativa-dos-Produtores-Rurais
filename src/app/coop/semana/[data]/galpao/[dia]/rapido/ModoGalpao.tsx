"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { arred, kg } from "@/lib/coop/numeros";
import type { Recebimento } from "@/lib/coop/tipos";
import { salvarEntrega, salvarRecebimento } from "../../../../../acoes";
import { Aviso, lerNumero, mostrarNumero, useAcao } from "../../../../../ui";
import type { CartaoProdutor } from "../Galpao";

type Caixa = { grande: number; pequena: number };
type Item = CartaoProdutor["itens"][number];
// Uma linha por produto: pesagens já somadas + a que está sendo digitada, caixas e recusado.
type Linha = { pesagens: number[]; balanca: string; grandes: number; pequenas: number; recusado: string; abrirRecusa: boolean };

const CHAVE_QUEM = "coop-quem-confere";
// Quem está conferindo fica lembrado neste celular.
const ouvintes = new Set<() => void>();
function lerQuem() {
  try {
    return localStorage.getItem(CHAVE_QUEM) ?? "";
  } catch {
    return "";
  }
}
function gravarQuem(n: string) {
  try {
    localStorage.setItem(CHAVE_QUEM, n);
  } catch {}
  ouvintes.forEach((f) => f());
}
const assinarQuem = (f: () => void) => {
  ouvintes.add(f);
  return () => ouvintes.delete(f);
};
const agora = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const num = (t: string) => {
  const v = lerNumero(t);
  return v === null || Number.isNaN(v) ? null : v;
};

function situacao(c: CartaoProdutor): "falta" | "ok" | "naoVeio" {
  if (!c.lancado) return "falta";
  const comPedido = c.itens.filter((i) => i.planejado > 0.004);
  return comPedido.length && comPedido.every((i) => (i.entregue ?? 0) <= 0.004) ? "naoVeio" : "ok";
}

export function ModoGalpao({
  data,
  dia,
  titulo,
  outroDia,
  cartoes,
  caixa,
  equipe,
}: {
  data: string;
  dia: "1" | "2";
  titulo: string;
  outroDia: { dia: string; nome: string };
  cartoes: CartaoProdutor[];
  caixa: Caixa;
  equipe: string[];
}) {
  const [aberto, setAberto] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const quem = useSyncExternalStore(assinarQuem, lerQuem, () => "");
  const [ultimo, setUltimo] = useState<string | null>(null);
  const escolherQuem = gravarQuem;

  const feitos = cartoes.filter((c) => c.lancado).length;
  const atual = cartoes.find((c) => c.id === aberto);
  if (atual)
    return (
      <Produtor
        key={atual.id}
        data={data}
        dia={dia}
        c={atual}
        caixa={caixa}
        quem={quem}
        voltar={(texto) => {
          setAberto(null);
          setUltimo(texto ?? null);
          window.scrollTo({ top: 0 });
        }}
      />
    );

  const ordem = { falta: 0, naoVeio: 1, ok: 2 } as const;
  const lista = cartoes.filter((c) => c.nome.toLowerCase().includes(busca.toLowerCase())).sort((a, b) => ordem[situacao(a)] - ordem[situacao(b)]);
  return (
    <div className="mg">
      <div className="mg-topo">
        <div>
          <h2>Galpão · {titulo}</h2>
          <Link href={`/coop/semana/${data}/galpao/${outroDia.dia}/rapido`} className="discreto">
            Trocar para {outroDia.nome}
          </Link>
        </div>
        <div className="mg-progresso" aria-label={`${feitos} de ${cartoes.length} lançados`}>
          <strong>
            {feitos}/{cartoes.length}
          </strong>
          <span>lançados</span>
        </div>
      </div>
      <div className="mg-barra">
        <span style={{ width: `${cartoes.length ? (feitos / cartoes.length) * 100 : 0}%` }} />
      </div>
      {ultimo && <div className="ok">{ultimo}</div>}
      {equipe.length > 0 && (
        <div className="mg-quem">
          <span>Quem está conferindo:</span>
          {equipe.map((n) => (
            <button type="button" key={n} className={quem === n ? "ativo" : ""} onClick={() => escolherQuem(quem === n ? "" : n)}>
              {n}
            </button>
          ))}
        </div>
      )}
      <input data-livre className="mg-busca" type="search" placeholder="Procurar produtor…" value={busca} onChange={(e) => setBusca(e.target.value)} />
      <div className="mg-lista">
        {lista.map((c) => {
          const s = situacao(c);
          const pedido = c.itens.filter((i) => i.planejado > 0.004);
          const total = c.itens.reduce((t, i) => t + (i.entregue ?? 0), 0);
          return (
            <button type="button" key={c.id} className={`mg-produtor ${s}`} onClick={() => setAberto(c.id)}>
              <span className="mg-nome">{c.nome}</span>
              <span className="mg-itens">{pedido.map((i) => `${i.produto} ${kg(i.planejado)} ${i.unidade}`).join(" · ") || "Sem pedido no dia"}</span>
              <span className="mg-estado">
                {s === "falta" ? "Falta lançar" : s === "naoVeio" ? "Não veio" : `✓ ${kg(total)} kg${c.recebimento?.hora ? ` · ${c.recebimento.hora}` : ""}`}
              </span>
            </button>
          );
        })}
        {!lista.length && <p className="discreto">Ninguém com esse nome.</p>}
      </div>
      <p className="discreto" style={{ marginTop: 16 }}>
        Entrega extra e ajustes finos: <Link href={`/coop/semana/${data}/galpao/${dia}`}>tela completa do galpão</Link>.
      </p>
    </div>
  );
}

function Produtor({ data, dia, c, caixa, quem, voltar }: { data: string; dia: "1" | "2"; c: CartaoProdutor; caixa: Caixa; quem: string; voltar: (texto?: string) => void }) {
  const [outros, setOutros] = useState<string[]>([]);
  const visiveis = c.itens.filter((i) => i.planejado > 0.004 || i.entregue !== null || outros.includes(i.produto));
  const faltam = c.itens.filter((i) => !visiveis.includes(i));
  const [v, setV] = useState<Record<string, Linha>>(() =>
    Object.fromEntries(
      c.itens.map((i) => {
        const rec = c.recebimento?.recusado?.[i.produto] ?? 0;
        // Já lançado: começa com o que foi gravado (aceito + recusado), sem caixas.
        const salvo = i.entregue === null ? "" : mostrarNumero(arred(i.entregue + rec));
        return [i.produto, { pesagens: [], balanca: salvo, grandes: 0, pequenas: 0, recusado: rec ? mostrarNumero(rec) : "", abrirRecusa: rec > 0 }];
      }),
    ),
  );
  const { pendente, aviso, rodar } = useAcao();

  const bruto = (l: Linha) => {
    const b = num(l.balanca);
    if (!l.pesagens.length && b === null) return null;
    return l.pesagens.reduce((s, x) => s + x, 0) + (b ?? 0);
  };
  const liquido = (l: Linha) => {
    const b = bruto(l);
    return b === null ? null : Math.max(0, arred(b - l.grandes * caixa.grande - l.pequenas * caixa.pequena));
  };
  const recusado = (l: Linha) => num(l.recusado) ?? 0;
  const aceito = (l: Linha, i: Item) => {
    const x = liquido(l);
    if (x === null) return recusado(l) > 0 ? Math.max(0, arred(i.planejado - recusado(l))) : null;
    return Math.max(0, arred(x - recusado(l)));
  };
  const invalido = Object.values(v).some((l) => Number.isNaN(lerNumero(l.balanca)) || Number.isNaN(lerNumero(l.recusado)));
  const mudar = (p: string, m: Partial<Linha>) => setV((o) => ({ ...o, [p]: { ...o[p], ...m } }));

  function salvar(modo: "normal" | "tudoCerto" | "naoVeio") {
    const valores: Record<string, number | null> = {};
    const rec: Record<string, number> = {};
    for (const i of c.itens) {
      const l = v[i.produto];
      if (modo === "naoVeio") valores[i.produto] = i.planejado > 0.004 ? 0 : null;
      else if (modo === "tudoCerto") valores[i.produto] = i.planejado > 0.004 ? i.planejado : i.entregue;
      else {
        if (recusado(l) > 0) rec[i.produto] = recusado(l);
        // Em branco = veio o pedido do dia.
        valores[i.produto] = aceito(l, i) ?? (i.planejado > 0.004 ? i.planejado : null);
      }
    }
    const antes = c.recebimento ?? {};
    const recebimento: Recebimento | null =
      modo === "naoVeio"
        ? null
        : {
            ...antes,
            hora: antes.hora || agora(),
            conferente: quem || antes.conferente,
            qualidade: Object.keys(rec).length ? "ruim" : antes.qualidade,
            recusado: rec,
          };
    rodar(
      async () => {
        const a = await salvarEntrega(data, dia, c.id, valores);
        if (!a.ok) return a;
        return salvarRecebimento(data, dia, c.id, recebimento);
      },
      "Salvo.",
      () => voltar(modo === "naoVeio" ? `${c.curto}: marcado que não veio.` : `${c.curto}: lançado.`),
    );
  }

  return (
    <div className="mg">
      <div className="mg-topo">
        <button type="button" className="botao claro" onClick={() => voltar()}>
          ‹ Lista
        </button>
        <div style={{ textAlign: "right" }}>
          <h2>{c.nome}</h2>
          <Link className="discreto" href={`/coop/semana/${data}/imprimir/produtores?dia=${dia}&produtor=${encodeURIComponent(c.id)}`}>
            📄 Ver romaneio
          </Link>
          {c.recebimento?.hora && " · "}
          {c.recebimento?.hora && (
            <span className="discreto">
              Chegou {c.recebimento.hora}
              {c.recebimento.conferente ? ` · ${c.recebimento.conferente}` : ""}
            </span>
          )}
        </div>
      </div>

      <button type="button" className="mg-tudo-certo" disabled={pendente} onClick={() => salvar("tudoCerto")}>
        ✓ Veio tudo certo
        <small>conta o pedido do dia, sem pesar</small>
      </button>

      {visiveis.map((i) => {
        const l = v[i.produto];
        const x = aceito(l, i);
        const liq = liquido(l);
        const dif = x === null ? 0 : arred(x - i.planejado);
        const desconto = l.grandes * caixa.grande + l.pequenas * caixa.pequena;
        return (
          <div className="mg-produto" key={i.produto}>
            <div className="mg-cab">
              <strong>{i.produto}</strong>
              <span>
                Pedido <b>{kg(i.planejado)}</b> {i.unidade}
              </span>
            </div>

            <label className="mg-campo">
              <span>{l.pesagens.length ? "Mais uma pesagem (kg)" : "Balança (kg)"}</span>
              <input type="text" inputMode="decimal" value={l.balanca} placeholder={i.planejado > 0.004 ? "pese aqui" : "0"} onChange={(e) => mudar(i.produto, { balanca: e.target.value })} aria-label={`Balança ${i.produto}`} />
            </label>
            {l.pesagens.length > 0 && (
              <p className="mg-pesagens">
                Pesagens: {l.pesagens.map((p) => kg(p)).join(" + ")}
                {num(l.balanca) ? ` + ${kg(num(l.balanca)!)}` : ""}
                <button type="button" onClick={() => mudar(i.produto, { pesagens: l.pesagens.slice(0, -1) })}>
                  desfazer
                </button>
              </p>
            )}
            {num(l.balanca) !== null && (num(l.balanca) ?? 0) > 0 && (
              <button type="button" className="mg-somar" onClick={() => mudar(i.produto, { pesagens: [...l.pesagens, num(l.balanca)!], balanca: "" })}>
                ＋ Somar outra pesagem
              </button>
            )}

            <div className="mg-caixas">
              <Contador rotulo={`Caixa grande (${mostrarNumero(caixa.grande)} kg)`} valor={l.grandes} aoMudar={(n) => mudar(i.produto, { grandes: n })} />
              <Contador rotulo={`Caixa pequena (${mostrarNumero(caixa.pequena)} kg)`} valor={l.pequenas} aoMudar={(n) => mudar(i.produto, { pequenas: n })} />
            </div>

            {l.abrirRecusa ? (
              <label className="mg-campo recusa">
                <span>Recusado, produto ruim (kg)</span>
                <input type="text" inputMode="decimal" value={l.recusado} placeholder="0" onChange={(e) => mudar(i.produto, { recusado: e.target.value })} aria-label={`Recusado ${i.produto}`} />
              </label>
            ) : (
              <button type="button" className="mg-link" onClick={() => mudar(i.produto, { abrirRecusa: true })}>
                Veio algo ruim? Recusar uma parte
              </button>
            )}

            <div className={`mg-resultado ${x === null ? "" : Math.abs(dif) < 0.005 ? "igual" : dif < 0 ? "menos" : "mais"}`}>
              {x === null ? (
                <span>Em branco = veio o pedido ({kg(i.planejado)} kg)</span>
              ) : (
                <>
                  <span className="mg-conta">
                    {liq !== null && desconto > 0 ? `${kg(bruto(l) ?? 0)} − ${kg(desconto)} de caixas` : ""}
                    {recusado(l) > 0 ? ` − ${kg(recusado(l))} recusado` : ""}
                  </span>
                  <span className="mg-liquido">
                    <b>{kg(x)}</b> kg
                  </span>
                  <span className="mg-dif">{Math.abs(dif) < 0.005 ? "igual ao pedido" : `${dif > 0 ? "+" : ""}${kg(dif)} kg ${dif < 0 ? "a menos" : "a mais"}`}</span>
                </>
              )}
            </div>
          </div>
        );
      })}

      {faltam.length > 0 && (
        <select className="mg-outro" value="" onChange={(e) => e.target.value && setOutros([...outros, e.target.value])} aria-label="Trouxe outro produto">
          <option value="">＋ Trouxe outro produto…</option>
          {faltam.map((i) => (
            <option key={i.produto} value={i.produto}>
              {i.produto}
            </option>
          ))}
        </select>
      )}

      <Aviso aviso={aviso} />
      <div className="mg-rodape">
        <button type="button" className="botao perigo" disabled={pendente} onClick={() => salvar("naoVeio")}>
          Não veio
        </button>
        <button type="button" className="botao" disabled={pendente || invalido} onClick={() => salvar("normal")}>
          {pendente ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </div>
  );
}

function Contador({ rotulo, valor, aoMudar }: { rotulo: string; valor: number; aoMudar: (n: number) => void }) {
  return (
    <div className="mg-contador">
      <span>{rotulo}</span>
      <div>
        <button type="button" onClick={() => aoMudar(Math.max(0, valor - 1))} aria-label={`Menos ${rotulo}`} disabled={valor === 0}>
          −
        </button>
        <b>{valor}</b>
        <button type="button" onClick={() => aoMudar(valor + 1)} aria-label={`Mais ${rotulo}`}>
          +
        </button>
      </div>
    </div>
  );
}
