"use client";

import { useState } from "react";
import { salvarPin } from "../acoes";
import { Aviso, useAcao } from "../ui";

export function Celular({ enderecos }: { enderecos: string[] }) {
  const [pin, setPin] = useState("");
  const { pendente, aviso, rodar } = useAcao();
  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Celular</h2>
      <p style={{ marginTop: 0 }}>
        Com o app aberto neste PC, o celular <strong>no mesmo Wi-Fi</strong> abre:
      </p>
      {enderecos.length ? (
        <ul>
          {enderecos.map((e) => (
            <li key={e}>
              <code style={{ fontSize: 17 }}>{e}</code>
            </li>
          ))}
        </ul>
      ) : (
        <p className="aviso">Este PC não está em nenhuma rede agora.</p>
      )}
      <p className="discreto">
        Ele pede o PIN uma vez e lembra por 1 ano. No celular, use “Adicionar à tela inicial” para ficar com o ícone da cooperativa. Longe do galpão? Ligue o roteador do
        celular e conecte o notebook nele.
      </p>
      <div className="botoes" data-livre>
        <label className="campo">
          Trocar o PIN (4 a 8 números)
          <input type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} style={{ width: 140 }} />
        </label>
        <button type="button" className="botao claro" disabled={pendente || pin.length < 4} onClick={() => rodar(() => salvarPin(pin), "PIN trocado. No celular, entre de novo com o novo PIN.", () => setPin(""))}>
          Salvar PIN
        </button>
      </div>
      <Aviso aviso={aviso} />
    </div>
  );
}
