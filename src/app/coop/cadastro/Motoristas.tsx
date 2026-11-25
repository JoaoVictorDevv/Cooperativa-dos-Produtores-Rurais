"use client";

import { useState } from "react";
import { salvarMotoristas } from "../acoes";
import { Aviso, useAcao } from "../ui";

// Motorista de cada rota (vale para segunda e terça). Sai no mapa e nos romaneios.
export function Motoristas({ inicial }: { inicial: Record<string, string> }) {
  const [m, setM] = useState(inicial);
  const { pendente, aviso, rodar } = useAcao();
  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Motoristas das rotas</h2>
      <p className="discreto" style={{ marginTop: 0 }}>
        Vale para as rotas de segunda e de terça. O nome sai no mapa, nos romaneios e nos retornos.
      </p>
      <div className="botoes" style={{ alignItems: "flex-end" }}>
        {["1", "2", "3", "4"].map((n) => (
          <label key={n} className="campo">
            Rota {n}
            <input type="text" value={m[n] ?? ""} onChange={(e) => setM({ ...m, [n]: e.target.value })} style={{ width: 140 }} />
          </label>
        ))}
        <button type="button" className="botao" disabled={pendente} onClick={() => rodar(() => salvarMotoristas(m), "Motoristas salvos.")}>
          Salvar motoristas
        </button>
      </div>
      <Aviso aviso={aviso} />
    </div>
  );
}
