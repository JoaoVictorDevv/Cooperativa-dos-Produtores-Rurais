"use client";

import { useState } from "react";
import { marcarSemanaPaga } from "../../../acoes";
import { useAcao } from "../../../ui";

// Um ✓ só por semana: os produtores já foram pagos.
export function SemanaPaga({ data, pagoEm }: { data: string; pagoEm: string | null }) {
  const { pendente, rodar } = useAcao();
  const [local, setLocal] = useState<{ de: string | null; v: boolean }>({ de: pagoEm, v: Boolean(pagoEm) });
  const marcado = local.de === pagoEm ? local.v : Boolean(pagoEm);
  return (
    <label className="semana-paga">
      <input
        data-livre
        type="checkbox"
        checked={marcado}
        disabled={pendente}
        onChange={(e) => {
          const v = e.target.checked;
          setLocal({ de: pagoEm, v });
          rodar(() => marcarSemanaPaga(data, v), v ? "Semana marcada como paga." : "Desmarcada.");
        }}
      />
      Produtores desta semana já foram pagos
      {marcado && pagoEm && <span className="discreto"> (marcado em {pagoEm.split("-").reverse().slice(0, 2).join("/")})</span>}
    </label>
  );
}
