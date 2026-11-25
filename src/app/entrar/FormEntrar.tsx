"use client";

import { useActionState } from "react";
import { entrar } from "./acao";

export function FormEntrar({ volta }: { volta: string }) {
  const [estado, acao, pendente] = useActionState(entrar, null);
  return (
    <form action={acao} className="card">
      <input type="hidden" name="volta" value={volta} />
      <input type="password" name="pin" inputMode="numeric" autoComplete="current-password" placeholder="PIN" aria-label="PIN" autoFocus required className="pin" />
      <button className="botao" disabled={pendente} style={{ width: "100%" }}>
        {pendente ? "Entrando…" : "Entrar"}
      </button>
      {estado?.erro && (
        <p className="erro" role="alert">
          {estado.erro}
        </p>
      )}
    </form>
  );
}
