"use client";

import { useActionState } from "react";
import { reopenWeek, type ReopenFormState } from "@/app/actions/weeks";

const initialState: ReopenFormState = {};

export function ReopenForm({ weekId }: { weekId: string }) {
  const action = (state: ReopenFormState, formData: FormData) => reopenWeek(weekId, state, formData);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="card" style={{ padding: 18, borderLeft: "3px solid var(--brick)" }}>
      <div className="panel-title" style={{ padding: 0, marginBottom: 10 }}>
        Reabrir semana (ADMIN)
      </div>
      <label className="login-label" htmlFor="reason">
        Motivo da reabertura (obrigatório, fica registrado na auditoria)
      </label>
      <textarea
        className="login-input"
        id="reason"
        name="reason"
        rows={2}
        required
        style={{ fontFamily: "inherit", resize: "vertical" }}
      />
      {state.error && <p className="login-error">{state.error}</p>}
      <button className="btn-danger" type="submit" disabled={pending} style={{ alignSelf: "flex-start" }}>
        {pending ? "Reabrindo…" : "Reabrir semana"}
      </button>
    </form>
  );
}
