"use client";

import { useActionState } from "react";
import { createWeek, type WeekFormState } from "@/app/actions/weeks";

const initialState: WeekFormState = {};

export function NewWeekForm() {
  const [state, formAction, pending] = useActionState(createWeek, initialState);

  return (
    <form action={formAction} className="card" style={{ padding: 20, marginBottom: 26 }}>
      <div className="panel-title" style={{ padding: 0, marginBottom: 14 }}>
        Nova semana operacional
      </div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div>
          <label className="login-label" htmlFor="referenceDate">
            Data de referência (domingo)
          </label>
          <input className="login-input" style={{ marginBottom: 0 }} type="date" id="referenceDate" name="referenceDate" required />
        </div>
        <div>
          <label className="login-label" htmlFor="startDate">
            Início
          </label>
          <input className="login-input" style={{ marginBottom: 0 }} type="date" id="startDate" name="startDate" required />
        </div>
        <div>
          <label className="login-label" htmlFor="endDate">
            Fim
          </label>
          <input className="login-input" style={{ marginBottom: 0 }} type="date" id="endDate" name="endDate" required />
        </div>
        <button className="btn-primary" type="submit" disabled={pending}>
          {pending ? "Criando…" : "Criar semana"}
        </button>
      </div>
      {state.error && <p className="login-error" style={{ marginTop: 12 }}>{state.error}</p>}
    </form>
  );
}
