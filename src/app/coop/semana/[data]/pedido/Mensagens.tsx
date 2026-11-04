"use client";

import { useState } from "react";
import { juntarPergunta, linkWhatsApp } from "@/lib/coop/mensagens";
import { marcarMensagemEnviada } from "../../../acoes";
import { useAcao } from "../../../ui";

interface Item {
  id: string;
  nome: string;
  curto: string;
  telefone: string | null;
  pedido: string | null;
  enviadaEm: string | null;
}

export function Mensagens({ data, itens, sugestao }: { data: string; itens: Item[]; sugestao: { proxima: string; diasProxima: string; prazo: string } }) {
  const [o, setO] = useState(sugestao);
  const [semPedido, setSemPedido] = useState(false);
  const lista = itens.filter((i) => semPedido || i.pedido);
  const enviadas = itens.filter((i) => i.pedido && i.enviadaEm).length;
  const total = itens.filter((i) => i.pedido).length;
  return (
    <>
      <div className="card">
        <p style={{ marginTop: 0 }}>
          <strong>Como funciona:</strong> clique em <em>Abrir no WhatsApp</em>. A conversa do produtor abre com o texto pronto; é só apertar enviar. O app marca como enviada.
          Já foram {enviadas} de {total}.
        </p>
        <div className="botoes" style={{ alignItems: "flex-end" }}>
          <label className="campo">
            Pergunta da entrega seguinte: data
            <input type="text" value={o.proxima} onChange={(e) => setO({ ...o, proxima: e.target.value })} style={{ width: 110 }} />
          </label>
          <label className="campo">
            Dias no galpão
            <input type="text" value={o.diasProxima} onChange={(e) => setO({ ...o, diasProxima: e.target.value })} style={{ width: 240 }} />
          </label>
          <label className="campo">
            Prazo da nutrição
            <input type="text" value={o.prazo} onChange={(e) => setO({ ...o, prazo: e.target.value })} style={{ width: 140 }} />
          </label>
          <label className="discreto">
            <input type="checkbox" checked={semPedido} onChange={(e) => setSemPedido(e.target.checked)} /> mostrar também quem não tem pedido (só a pergunta)
          </label>
        </div>
      </div>
      <div className="grade" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(330px, 1fr))" }}>
        {lista.map((i) => (
          <Cartao key={i.id} data={data} i={i} texto={juntarPergunta(i, i.pedido, o)} />
        ))}
      </div>
    </>
  );
}

function Cartao({ data, i, texto }: { data: string; i: Item; texto: string }) {
  const { rodar } = useAcao();
  const [copiado, setCopiado] = useState(false);
  const link = linkWhatsApp(i.telefone, texto);
  return (
    <div className="card" style={{ marginBottom: 0 }}>
      <div className="botoes" style={{ justifyContent: "space-between" }}>
        <strong>{i.nome}</strong>
        {i.enviadaEm ? (
          <span className="etiqueta verde">enviada {new Date(i.enviadaEm).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
        ) : i.pedido ? (
          <span className="etiqueta amarela">falta enviar</span>
        ) : (
          <span className="etiqueta">sem pedido</span>
        )}
      </div>
      <pre className="msg">{texto}</pre>
      <div className="botoes">
        {link ? (
          <a className="botao zap" href={link} target="_blank" rel="noreferrer" onClick={() => rodar(() => marcarMensagemEnviada(data, i.id), "Marcada como enviada.")}>
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
        {!i.enviadaEm && i.pedido && (
          <button type="button" className="botao claro pequeno" onClick={() => rodar(() => marcarMensagemEnviada(data, i.id), "Marcada como enviada.")}>
            Já mandei
          </button>
        )}
      </div>
    </div>
  );
}
