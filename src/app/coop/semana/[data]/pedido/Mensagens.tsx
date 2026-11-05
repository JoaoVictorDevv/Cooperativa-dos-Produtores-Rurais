"use client";

import { useState } from "react";
import Link from "next/link";
import { linkWhatsApp } from "@/lib/coop/mensagens";
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

export function Mensagens({ data, itens }: { data: string; itens: Item[] }) {
  const lista = itens.filter((i) => i.pedido);
  const enviadas = lista.filter((i) => i.enviadaEm).length;
  return (
    <>
      <div className="card">
        <p style={{ margin: 0 }}>
          <strong>Como funciona:</strong> clique em <em>Abrir no WhatsApp</em>. A conversa do produtor abre com o texto pronto; é só apertar enviar. O app marca como enviada.
          Já foram {enviadas} de {lista.length}. A pergunta da previsão vai separada, depois da entrega (tela <Link href="/coop/previsao">Previsão</Link>).
        </p>
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
