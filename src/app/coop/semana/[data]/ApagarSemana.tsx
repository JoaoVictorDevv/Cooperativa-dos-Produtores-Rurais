"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apagarSemana } from "../../acoes";
import { Aviso, useAcao } from "../../ui";

export function ApagarSemana({ data, referencia }: { data: string; referencia: string }) {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const { pendente, aviso, rodar } = useAcao();
  const router = useRouter();
  if (!aberto)
    return (
      <button type="button" className="botao claro pequeno" onClick={() => setAberto(true)}>
        Apagar esta semana…
      </button>
    );
  return (
    <div className="card" style={{ borderColor: "var(--c-vermelho)" }}>
      <strong>Apagar a semana {referencia}?</strong>
      <p className="discreto">Uma cópia fica na pasta historico/. Para confirmar, digite a data da semana ({referencia}).</p>
      <div className="botoes">
        <input type="text" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={referencia} style={{ width: 140 }} />
        <button type="button" className="botao perigo" disabled={pendente || texto.trim() !== referencia} onClick={() => rodar(() => apagarSemana(data, texto), "Semana apagada.", () => router.push("/coop"))}>
          Apagar
        </button>
        <button type="button" className="botao claro" onClick={() => setAberto(false)}>
          Cancelar
        </button>
      </div>
      <Aviso aviso={aviso} />
    </div>
  );
}
