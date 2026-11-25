"use client";

import { useState } from "react";
import Link from "next/link";
import { linkWhatsApp } from "@/lib/coop/mensagens";
import { marcarMensagens, salvarRecado } from "../../../acoes";
import { Aviso, useAcao } from "../../../ui";

interface Item {
  id: string;
  nome: string;
  curto: string;
  telefone: string | null;
  pedido: string | null;
  enviadaEm: string | null;
  recado: string;
}

export function Mensagens({ data, itens }: { data: string; itens: Item[] }) {
  const lista = itens.filter((i) => i.pedido);
  const enviadas = lista.filter((i) => i.enviadaEm).length;
  const todas = lista.length > 0 && enviadas === lista.length;
  const { pendente, aviso, rodar } = useAcao();
  return (
    <>
      <div className="card botoes" style={{ justifyContent: "space-between" }}>
        <p style={{ margin: 0, flex: "1 1 420px" }}>
          Clique em <em>Abrir no WhatsApp</em>: a conversa abre com o texto pronto e o app marca o ✓. Mandou por fora (ex.: copiou tudo de uma vez)? Marque o ✓ de
          cada um ou use <strong>Já mandei para todos</strong>. A pergunta da previsão vai separada (tela <Link href="/coop/previsao">Previsão</Link>).
        </p>
        <span className="botoes">
          <strong style={{ color: todas ? "var(--c-verde)" : undefined }}>
            {enviadas} de {lista.length} enviadas
          </strong>
          {todas ? (
            <button type="button" className="botao claro pequeno" disabled={pendente} onClick={() => rodar(() => marcarMensagens(data, lista.map((i) => i.id), false), "Desmarcadas.")}>
              desmarcar todas
            </button>
          ) : (
            <button type="button" className="botao" disabled={pendente || !lista.length} onClick={() => rodar(() => marcarMensagens(data, lista.map((i) => i.id), true), "Pronto: todas marcadas como enviadas.")}>
              ✓ Já mandei para todos
            </button>
          )}
        </span>
        <Aviso aviso={aviso} />
      </div>
      <div className="grade" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(330px, 1fr))" }}>
        {lista.map((i) => (
          <Cartao key={i.id} data={data} i={i} texto={i.pedido ?? ""} />
        ))}
      </div>
    </>
  );
}

function Cartao({ data, i, texto }: { data: string; i: Item; texto: string }) {
  const { pendente, aviso, rodar } = useAcao();
  const [copiado, setCopiado] = useState(false);
  const [recado, setRecado] = useState(i.recado);
  const [abrirRecado, setAbrirRecado] = useState(Boolean(i.recado));
  const link = linkWhatsApp(i.telefone, texto);
  // O ✓ muda na hora; o servidor confirma em seguida.
  const [marcada, setMarcada] = useState<{ de: string | null; v: boolean }>({ de: i.enviadaEm, v: Boolean(i.enviadaEm) });
  const enviada = marcada.de === i.enviadaEm ? marcada.v : Boolean(i.enviadaEm);
  return (
    <div className={`card msg-cartao${enviada ? " enviada" : ""}`} style={{ marginBottom: 0 }}>
      <label className="msg-check" title={enviada ? "Desmarcar" : "Marcar como enviada"}>
        <input data-livre type="checkbox" checked={enviada} disabled={pendente} onChange={(e) => {
            const v = e.target.checked;
            setMarcada({ de: i.enviadaEm, v });
            rodar(() => marcarMensagens(data, [i.id], v), v ? "Marcada como enviada." : "Desmarcada.");
          }}
        />
        <strong>{i.nome}</strong>
        {enviada && i.enviadaEm && (
          <small className="discreto" suppressHydrationWarning>
            {" "}
            enviada {new Date(i.enviadaEm!).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
          </small>
        )}
      </label>
      <pre className="msg">{texto}</pre>
      {abrirRecado ? (
        <div className="botoes" style={{ marginBottom: 8 }}>
          <input type="text" value={recado} maxLength={300} onChange={(e) => setRecado(e.target.value)} placeholder="ex.: Quando deixar no galpão, identifica a carga com seu nome, por favor." style={{ flex: "1 1 220px" }} aria-label={`Recado para ${i.curto}`} />
          <button type="button" className="botao claro pequeno" disabled={pendente || recado.trim() === i.recado} onClick={() => rodar(() => salvarRecado(data, i.id, recado), recado.trim() ? "Recado posto na mensagem." : "Recado tirado.")}>
            salvar recado
          </button>
        </div>
      ) : null}
      <div className="botoes">
        {link ? (
          <a className="botao zap" href={link} target="_blank" rel="noreferrer" onClick={() => !enviada && rodar(() => marcarMensagens(data, [i.id], true), "Marcada como enviada.")}>
            Abrir no WhatsApp
          </a>
        ) : (
          <span className="etiqueta vermelha">sem telefone no cadastro</span>
        )}
        <button
          type="button"
          className="botao claro pequeno"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(texto);
              setCopiado(true);
              setTimeout(() => setCopiado(false), 1500);
            } catch {
              setCopiado(false);
            }
          }}
        >
          {copiado ? "Copiado!" : "Copiar texto"}
        </button>
        {!abrirRecado && (
          <button type="button" className="botao claro pequeno" onClick={() => setAbrirRecado(true)}>
            + recado
          </button>
        )}
      </div>
      <Aviso aviso={aviso} />
    </div>
  );
}
