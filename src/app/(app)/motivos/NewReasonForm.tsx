"use client";

import { useActionState } from "react";
import { createReturnReason, type ReasonFormState } from "@/app/actions/returnReasons";

const initialState: ReasonFormState = {};

export function NewReasonForm() {
  const [state, formAction, pending] = useActionState(createReturnReason, initialState);

  return (
    <form action={formAction} className="card" style={{ padding: 20, marginBottom: 26 }}>
      <div className="panel-title" style={{ padding: 0, marginBottom: 14 }}>
        Novo motivo de devolução
      </div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div>
          <label className="login-label" htmlFor="code">
            Código
          </label>
          <input className="login-input" style={{ marginBottom: 0, width: 90 }} type="number" min={1} id="code" name="code" required />
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <label className="login-label" htmlFor="description">
            Descrição
          </label>
          <input className="login-input" style={{ marginBottom: 0 }} id="description" name="description" required />
        </div>
        <button className="btn-primary" type="submit" disabled={pending}>
          {pending ? "Salvando…" : "Adicionar"}
        </button>
      </div>
      {state.error && <p className="login-error" style={{ marginTop: 12 }}>{state.error}</p>}
    </form>
  );
}
